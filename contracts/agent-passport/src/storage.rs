use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::{AgentProfile, Config};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Config,
    Profile(Address),
    Interaction(BytesN<32>),
    Rating(BytesN<32>),
    ProviderInteractionCount(Address),
    ProviderInteractionBySequence(Address, u64),
}

pub(crate) fn read_config(e: &Env) -> Option<Config> {
    e.storage().persistent().get(&StorageKey::Config)
}

pub(crate) fn write_config(e: &Env, config: &Config) {
    e.storage().persistent().set(&StorageKey::Config, config);
}

pub(crate) fn read_profile(e: &Env, owner_address: &Address) -> Option<AgentProfile> {
    e.storage()
        .persistent()
        .get(&StorageKey::Profile(owner_address.clone()))
}

pub(crate) fn write_profile(e: &Env, profile: &AgentProfile) {
    e.storage()
        .persistent()
        .set(&StorageKey::Profile(profile.owner_address.clone()), profile);
}
