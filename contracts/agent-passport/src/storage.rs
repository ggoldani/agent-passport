use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::{AgentProfile, Config, InteractionRecord, RatingRecord};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Config,
    ProfileOwnersCount,
    ProfileOwnerByIndex(u64),
    ProfileOwnerIndex(Address),
    Profile(Address),
    ProviderCounterparty(Address, Address),
    ProviderRatingCount(Address),
    ProviderRatingTotal(Address),
    Interaction(BytesN<32>),
    Rating(BytesN<32>),
    ProviderInteractionCount(Address),
    ProviderInteractionBySequence(Address, u64),
    Relayer(Address),
    RelayersCount,
    RelayerByIndex(u64),
}

pub(crate) fn read_config(e: &Env) -> Option<Config> {
    e.storage().persistent().get(&StorageKey::Config)
}

pub(crate) fn write_config(e: &Env, config: &Config) {
    e.storage().persistent().set(&StorageKey::Config, config);
}

pub(crate) fn read_profile_owners_count(e: &Env) -> u64 {
    e.storage()
        .persistent()
        .get(&StorageKey::ProfileOwnersCount)
        .unwrap_or(0)
}

pub(crate) fn write_profile_owners_count(e: &Env, count: u64) {
    e.storage()
        .persistent()
        .set(&StorageKey::ProfileOwnersCount, &count);
}

pub(crate) fn read_profile_owner_by_index(e: &Env, index: u64) -> Option<Address> {
    e.storage()
        .persistent()
        .get(&StorageKey::ProfileOwnerByIndex(index))
}

pub(crate) fn write_profile_owner_by_index(e: &Env, index: u64, address: &Address) {
    e.storage()
        .persistent()
        .set(&StorageKey::ProfileOwnerByIndex(index), address);
}

pub(crate) fn remove_profile_owner_by_index(e: &Env, index: u64) {
    e.storage()
        .persistent()
        .remove(&StorageKey::ProfileOwnerByIndex(index));
}

pub(crate) fn read_profile_owner_index(e: &Env, address: &Address) -> Option<u64> {
    e.storage()
        .persistent()
        .get(&StorageKey::ProfileOwnerIndex(address.clone()))
}

pub(crate) fn write_profile_owner_index(e: &Env, address: &Address, index: u64) {
    e.storage()
        .persistent()
        .set(&StorageKey::ProfileOwnerIndex(address.clone()), &index);
}

pub(crate) fn remove_profile_owner_index(e: &Env, address: &Address) {
    e.storage()
        .persistent()
        .remove(&StorageKey::ProfileOwnerIndex(address.clone()));
}

pub(crate) fn append_profile_owner(e: &Env, owner_address: &Address) {
    let count = read_profile_owners_count(e);
    write_profile_owner_by_index(e, count, owner_address);
    write_profile_owner_index(e, owner_address, count);
    write_profile_owners_count(e, count + 1);
}

pub(crate) fn remove_profile_owner(e: &Env, owner_address: &Address) {
    let count = read_profile_owners_count(e);
    if count == 0 {
        return;
    }
    let index = match read_profile_owner_index(e, owner_address) {
        Some(i) => i,
        None => return,
    };
    let last_index = count - 1;
    if index != last_index {
        if let Some(last_owner) = read_profile_owner_by_index(e, last_index) {
            write_profile_owner_by_index(e, index, &last_owner);
            write_profile_owner_index(e, &last_owner, index);
        }
    }
    remove_profile_owner_by_index(e, last_index);
    remove_profile_owner_index(e, owner_address);
    write_profile_owners_count(e, last_index);
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

pub(crate) fn remove_profile(e: &Env, owner_address: &Address) {
    e.storage()
        .persistent()
        .remove(&StorageKey::Profile(owner_address.clone()));
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

pub(crate) fn read_provider_rating_count(e: &Env, provider_address: &Address) -> u64 {
    e.storage()
        .persistent()
        .get(&StorageKey::ProviderRatingCount(provider_address.clone()))
        .unwrap_or(0)
}

pub(crate) fn write_provider_rating_count(e: &Env, provider_address: &Address, count: u64) {
    e.storage()
        .persistent()
        .set(&StorageKey::ProviderRatingCount(provider_address.clone()), &count);
}

pub(crate) fn read_provider_rating_total(e: &Env, provider_address: &Address) -> u64 {
    e.storage()
        .persistent()
        .get(&StorageKey::ProviderRatingTotal(provider_address.clone()))
        .unwrap_or(0)
}

pub(crate) fn write_provider_rating_total(e: &Env, provider_address: &Address, total: u64) {
    e.storage()
        .persistent()
        .set(&StorageKey::ProviderRatingTotal(provider_address.clone()), &total);
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

pub(crate) fn is_relayer(e: &Env, address: &Address) -> bool {
    e.storage()
        .persistent()
        .get(&StorageKey::Relayer(address.clone()))
        .unwrap_or(false)
}

pub(crate) fn add_relayer_to_storage(e: &Env, address: &Address) {
    let count = read_relayers_count(e);
    e.storage()
        .persistent()
        .set(&StorageKey::Relayer(address.clone()), &true);
    e.storage()
        .persistent()
        .set(&StorageKey::RelayerByIndex(count), address);
    e.storage()
        .persistent()
        .set(&StorageKey::RelayersCount, &(count + 1));
}

pub(crate) fn remove_relayer_from_storage(e: &Env, address: &Address) {
    e.storage()
        .persistent()
        .remove(&StorageKey::Relayer(address.clone()));
    let count = read_relayers_count(e);
    let mut found_idx: Option<u64> = None;
    let mut i = 0;
    while i < count {
        if let Some(a) = read_relayer_by_index(e, i) {
            if a == *address {
                found_idx = Some(i);
                break;
            }
        }
        i += 1;
    }
    if let Some(idx) = found_idx {
        let last_idx = count - 1;
        if idx != last_idx {
            if let Some(last_addr) = read_relayer_by_index(e, last_idx) {
                e.storage()
                    .persistent()
                    .set(&StorageKey::RelayerByIndex(idx), &last_addr);
            }
        }
        e.storage()
            .persistent()
            .remove(&StorageKey::RelayerByIndex(last_idx));
        e.storage()
            .persistent()
            .set(&StorageKey::RelayersCount, &last_idx);
    }
}

pub(crate) fn read_relayers_count(e: &Env) -> u64 {
    e.storage()
        .persistent()
        .get(&StorageKey::RelayersCount)
        .unwrap_or(0)
}

pub(crate) fn read_relayer_by_index(e: &Env, index: u64) -> Option<Address> {
    e.storage().persistent().get(&StorageKey::RelayerByIndex(index))
}
