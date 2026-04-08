use soroban_sdk::{contracttype, Address, BytesN, Env, Vec};

use crate::types::{AgentProfile, Config, InteractionRecord, RatingRecord};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Config,
    ProfileOwners,
    Profile(Address),
    ProviderCounterparty(Address, Address),
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

pub(crate) fn read_profile_owners(e: &Env) -> Vec<Address> {
    e.storage()
        .persistent()
        .get(&StorageKey::ProfileOwners)
        .unwrap_or(Vec::new(e))
}

pub(crate) fn append_profile_owner(e: &Env, owner_address: &Address) {
    let mut owners = read_profile_owners(e);
    owners.push_back(owner_address.clone());
    e.storage().persistent().set(&StorageKey::ProfileOwners, &owners);
}

pub(crate) fn has_provider_counterparty(
    e: &Env,
    provider_address: &Address,
    consumer_address: &Address,
) -> bool {
    e.storage()
        .persistent()
        .get(&StorageKey::ProviderCounterparty(
            provider_address.clone(),
            consumer_address.clone(),
        ))
        .unwrap_or(false)
}

pub(crate) fn mark_provider_counterparty(
    e: &Env,
    provider_address: &Address,
    consumer_address: &Address,
) {
    e.storage().persistent().set(
        &StorageKey::ProviderCounterparty(provider_address.clone(), consumer_address.clone()),
        &true,
    );
}

pub(crate) fn read_interaction(e: &Env, tx_hash: &BytesN<32>) -> Option<InteractionRecord> {
    e.storage()
        .persistent()
        .get(&StorageKey::Interaction(tx_hash.clone()))
}

pub(crate) fn write_interaction(e: &Env, interaction: &InteractionRecord) {
    let sequence = read_provider_interaction_count(e, &interaction.provider_address);

    e.storage()
        .persistent()
        .set(&StorageKey::Interaction(interaction.tx_hash.clone()), interaction);
    e.storage().persistent().set(
        &StorageKey::ProviderInteractionBySequence(interaction.provider_address.clone(), sequence),
        &interaction.tx_hash,
    );
    e.storage().persistent().set(
        &StorageKey::ProviderInteractionCount(interaction.provider_address.clone()),
        &(sequence + 1),
    );
}

pub(crate) fn read_provider_interaction_count(e: &Env, provider_address: &Address) -> u64 {
    e.storage()
        .persistent()
        .get(&StorageKey::ProviderInteractionCount(provider_address.clone()))
        .unwrap_or(0)
}

pub(crate) fn read_provider_interaction_tx_hash(
    e: &Env,
    provider_address: &Address,
    sequence: u64,
) -> Option<BytesN<32>> {
    e.storage().persistent().get(&StorageKey::ProviderInteractionBySequence(
        provider_address.clone(),
        sequence,
    ))
}

pub(crate) fn read_rating(e: &Env, interaction_tx_hash: &BytesN<32>) -> Option<RatingRecord> {
    e.storage()
        .persistent()
        .get(&StorageKey::Rating(interaction_tx_hash.clone()))
}

pub(crate) fn write_rating(e: &Env, rating: &RatingRecord) {
    e.storage()
        .persistent()
        .set(&StorageKey::Rating(rating.interaction_tx_hash.clone()), rating);
}
