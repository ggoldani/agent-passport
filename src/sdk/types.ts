export type Address = string
export type Bytes32 = string

export interface Config {
  admin: Address
  authorized_relayer: Address
}

export interface AgentProfile {
  name: string
  description: string
  tags: string[]
  owner_address: Address
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
  created_at: number
  score: number
  verified_interactions_count: number
  total_economic_volume: bigint
  unique_counterparties_count: number
  last_interaction_timestamp: number
}

export interface AgentProfileInput {
  name: string
  description: string
  tags: string[]
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
}

export interface InteractionRecord {
  provider_address: Address
  consumer_address: Address
  amount: bigint
  tx_hash: Bytes32
  timestamp: number
  service_label: string | null
}

export interface RatingRecord {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
  timestamp: number
}

export interface RatingInput {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
}

export interface AgentProfileWithRecentInteractions {
  profile: AgentProfile
  recent_interactions: InteractionRecord[]
}
