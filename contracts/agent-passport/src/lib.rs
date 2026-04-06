#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env};

use crate::storage::{read_config, write_config};
use crate::types::Config;

mod errors;
mod storage;
mod types;

#[contract]
pub struct AgentPassport;

#[contractimpl]
impl AgentPassport {
    pub fn init(env: Env, admin: Address, authorized_relayer: Address) {
        let config = Config {
            admin,
            authorized_relayer,
        };

        write_config(&env, &config);
    }

    pub fn get_config(env: Env) -> Config {
        read_config(&env).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::{AgentPassport, AgentPassportClient};

    include!("test.rs");
}
