#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, Vec};

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

        let profile = AgentProfile {
            name: input.name,
            description: input.description,
            tags: input.tags,
            owner_address,
            service_url: input.service_url,
            mcp_server_url: input.mcp_server_url,
            payment_endpoint: input.payment_endpoint,
            created_at: env.ledger().timestamp(),
            score: 0,
            verified_interactions_count: 0,
            total_economic_volume: 0,
            unique_counterparties_count: 0,
            last_interaction_timestamp: 0,
        };

        write_profile(&env, &profile);
        append_profile_owner(&env, &profile.owner_address);
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
    }
}

#[cfg(test)]
mod test {
    use super::{AgentPassport, AgentPassportClient};

    include!("test.rs");
}
