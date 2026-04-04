use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub authorized_relayer: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentProfile {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub owner_address: Address,
    pub service_url: Option<String>,
    pub mcp_server_url: Option<String>,
    pub payment_endpoint: Option<String>,
    pub created_at: u64,
    pub score: u32,
    pub verified_interactions_count: u64,
    pub total_economic_volume: i128,
    pub unique_counterparties_count: u64,
    pub last_interaction_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentProfileInput {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub service_url: Option<String>,
    pub mcp_server_url: Option<String>,
    pub payment_endpoint: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InteractionRecord {
    pub provider_address: Address,
    pub consumer_address: Address,
    pub amount: i128,
    pub tx_hash: BytesN<32>,
    pub timestamp: u64,
    pub service_label: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InteractionInput {
    pub provider_address: Address,
    pub consumer_address: Address,
    pub amount: i128,
    pub tx_hash: BytesN<32>,
    pub timestamp: u64,
    pub service_label: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingRecord {
    pub provider_address: Address,
    pub consumer_address: Address,
    pub interaction_tx_hash: BytesN<32>,
    pub score: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingInput {
    pub provider_address: Address,
    pub consumer_address: Address,
    pub interaction_tx_hash: BytesN<32>,
    pub score: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Profile(Address),
    Interaction(BytesN<32>),
    Rating(BytesN<32>),
}
