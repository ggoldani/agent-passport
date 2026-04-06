use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Config,
    Profile(Address),
    Interaction(BytesN<32>),
    Rating(BytesN<32>),
    ProviderInteractionIndex(Address, BytesN<32>),
    ConsumerInteractionIndex(Address, BytesN<32>),
}
