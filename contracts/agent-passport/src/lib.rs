#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, panic_with_error, Address, Env, String, Vec};

use crate::errors::Error;
use crate::storage::{
    append_profile_owner, has_provider_counterparty, mark_provider_counterparty, read_config,
    read_interaction, read_profile, read_profile_owners, read_provider_interaction_count,
    read_provider_interaction_tx_hash, read_provider_rating_count, read_provider_rating_total,
    read_rating, write_config, write_interaction, write_profile, write_provider_rating_count,
    write_provider_rating_total, write_rating,
};
use crate::types::{
    AgentProfile, AgentProfileInput, Config, InteractionRecord, RatingInput, RatingRecord,
};

mod errors;
mod storage;
mod types;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentRegistered {
    #[topic]
    pub owner_address: Address,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub service_url: Option<String>,
    pub mcp_server_url: Option<String>,
    pub payment_endpoint: Option<String>,
    pub created_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InteractionRegistered {
    #[topic]
    pub provider_address: Address,
    #[topic]
    pub consumer_address: Address,
    pub tx_hash: soroban_sdk::BytesN<32>,
    pub amount: i128,
    pub timestamp: u64,
    pub service_label: Option<String>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingSubmitted {
    #[topic]
    pub provider_address: Address,
    #[topic]
    pub consumer_address: Address,
    #[topic]
    pub interaction_tx_hash: soroban_sdk::BytesN<32>,
    pub score: u32,
    pub timestamp: u64,
}

#[contract]
pub struct AgentPassport;

#[contractimpl]
impl AgentPassport {
    pub fn init(env: Env, admin: Address, authorized_relayer: Address) {
        if read_config(&env).is_some() {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        let config = Config {
            admin,
            authorized_relayer,
        };

        write_config(&env, &config);
    }

    pub fn get_config(env: Env) -> Config {
        read_config(&env).unwrap()
    }

    pub fn update_relayer(env: Env, admin: Address, authorized_relayer: Address) {
        admin.require_auth();

        let mut config = read_config(&env).unwrap();
        if admin != config.admin {
            panic_with_error!(&env, Error::OwnershipConflict);
        }

        config.authorized_relayer = authorized_relayer;
        write_config(&env, &config);
    }

    pub fn register_agent(env: Env, owner_address: Address, input: AgentProfileInput) {
        owner_address.require_auth();

        if read_profile(&env, &owner_address).is_some() {
            panic_with_error!(&env, Error::OwnershipConflict);
        }

        let created_at = env.ledger().timestamp();
        let profile = AgentProfile {
            name: input.name,
            description: input.description,
            tags: input.tags,
            owner_address,
            service_url: input.service_url,
            mcp_server_url: input.mcp_server_url,
            payment_endpoint: input.payment_endpoint,
            created_at,
            score: 0,
            verified_interactions_count: 0,
            total_economic_volume: 0,
            unique_counterparties_count: 0,
            last_interaction_timestamp: 0,
        };

        write_profile(&env, &profile);
        append_profile_owner(&env, &profile.owner_address);
        AgentRegistered {
            owner_address: profile.owner_address.clone(),
            name: profile.name.clone(),
            description: profile.description.clone(),
            tags: profile.tags.clone(),
            service_url: profile.service_url.clone(),
            mcp_server_url: profile.mcp_server_url.clone(),
            payment_endpoint: profile.payment_endpoint.clone(),
            created_at: profile.created_at,
        }
        .publish(&env);
    }

    pub fn get_agent(env: Env, owner_address: Address) -> AgentProfile {
        read_profile(&env, &owner_address).unwrap()
    }

    pub fn list_agents(env: Env) -> Vec<AgentProfile> {
        let owners = read_profile_owners(&env);
        let mut profiles = Vec::new(&env);
        for owner_address in owners.iter() {
            if let Some(profile) = read_profile(&env, &owner_address) {
                profiles.push_back(profile);
            }
        }

        profiles
    }

    pub fn register_interaction(env: Env, relayer: Address, interaction: InteractionRecord) {
        relayer.require_auth();

        let config = read_config(&env).unwrap();
        if relayer != config.authorized_relayer {
            panic_with_error!(&env, Error::UnauthorizedRelayer);
        }

        if read_interaction(&env, &interaction.tx_hash).is_some() {
            panic_with_error!(&env, Error::DuplicateTxHash);
        }

        let mut provider_profile = read_profile(&env, &interaction.provider_address).unwrap();
        provider_profile.verified_interactions_count += 1;
        provider_profile.total_economic_volume += interaction.amount.unsigned_abs();
        if !has_provider_counterparty(
            &env,
            &interaction.provider_address,
            &interaction.consumer_address,
        ) {
            provider_profile.unique_counterparties_count += 1;
            mark_provider_counterparty(
                &env,
                &interaction.provider_address,
                &interaction.consumer_address,
            );
        }
        if interaction.timestamp > provider_profile.last_interaction_timestamp {
            provider_profile.last_interaction_timestamp = interaction.timestamp;
        }

        write_interaction(&env, &interaction);
        write_profile(&env, &provider_profile);
        InteractionRegistered {
            provider_address: interaction.provider_address.clone(),
            consumer_address: interaction.consumer_address.clone(),
            tx_hash: interaction.tx_hash.clone(),
            amount: interaction.amount,
            timestamp: interaction.timestamp,
            service_label: interaction.service_label.clone(),
        }
        .publish(&env);
    }

    pub fn list_agent_interactions(env: Env, provider_address: Address) -> Vec<InteractionRecord> {
        let count = read_provider_interaction_count(&env, &provider_address);
        let mut interactions = Vec::new(&env);
        let mut remaining = count;

        while remaining > 0 {
            let sequence = remaining - 1;
            if let Some(tx_hash) =
                read_provider_interaction_tx_hash(&env, &provider_address, sequence)
            {
                if let Some(interaction) = read_interaction(&env, &tx_hash) {
                    interactions.push_back(interaction);
                }
            }
            remaining = sequence;
        }

        interactions
    }

    pub fn submit_rating(env: Env, rating: RatingInput) {
        rating.consumer_address.require_auth();

        if rating.score > 100 {
            panic_with_error!(&env, Error::InvalidScore);
        }

        let interaction = read_interaction(&env, &rating.interaction_tx_hash)
            .unwrap_or_else(|| panic_with_error!(&env, Error::MissingInteraction));
        if interaction.provider_address != rating.provider_address
            || interaction.consumer_address != rating.consumer_address
        {
            panic_with_error!(&env, Error::MissingInteraction);
        }

        if read_rating(&env, &rating.interaction_tx_hash).is_some() {
            panic_with_error!(&env, Error::DuplicateRating);
        }

        let record = RatingRecord {
            provider_address: rating.provider_address.clone(),
            consumer_address: rating.consumer_address.clone(),
            interaction_tx_hash: rating.interaction_tx_hash.clone(),
            score: rating.score,
            timestamp: env.ledger().timestamp(),
        };
        write_rating(&env, &record);

        let mut provider_profile = read_profile(&env, &rating.provider_address).unwrap();
        let next_count = read_provider_rating_count(&env, &rating.provider_address) + 1;
        let next_total = read_provider_rating_total(&env, &rating.provider_address)
            + u64::from(rating.score);
        write_provider_rating_count(&env, &rating.provider_address, next_count);
        write_provider_rating_total(&env, &rating.provider_address, next_total);
        provider_profile.score = (next_total / next_count) as u32;
        write_profile(&env, &provider_profile);
        RatingSubmitted {
            provider_address: rating.provider_address.clone(),
            consumer_address: rating.consumer_address.clone(),
            interaction_tx_hash: rating.interaction_tx_hash.clone(),
            score: rating.score,
            timestamp: record.timestamp,
        }
        .publish(&env);
    }
}

#[cfg(test)]
mod test {
    use super::{AgentPassport, AgentPassportClient};

    include!("test.rs");
}
