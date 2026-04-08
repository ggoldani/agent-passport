#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env};

use crate::errors::Error;
use crate::storage::{read_config, read_profile, write_config, write_profile};
use crate::types::{AgentProfile, AgentProfileInput, Config};

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
    }

    pub fn get_agent(env: Env, owner_address: Address) -> AgentProfile {
        read_profile(&env, &owner_address).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::{AgentPassport, AgentPassportClient};

    include!("test.rs");
}
