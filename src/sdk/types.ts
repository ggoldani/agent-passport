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
  created_at: bigint
  score: number
  verified_interactions_count: bigint
  total_economic_volume: bigint
  unique_counterparties_count: bigint
  last_interaction_timestamp: bigint
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
  timestamp: bigint
  service_label: string | null
}

export interface RatingRecord {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
  timestamp: bigint
}

export interface RatingInput {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
}

export interface RichRatingInput {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
  quality?: number
  speed?: number
  reliability?: number
  communication?: number
  comment?: string
}

export interface RichRatingRecord {
  provider_address: Address
  consumer_address: Address
  interaction_tx_hash: Bytes32
  score: number
  quality: number | null
  speed: number | null
  reliability: number | null
  communication: number | null
  comment: string | null
  submitted_at: string
}

export interface TrustCheckOptions {
  threshold?: number
  minInteractions?: number
}

export interface TrustCheckResult {
  trusted: boolean
  address: string
  name: string
  score: number
  trust_tier: string | null
  verified_interactions: number
  unique_counterparties: number
  last_active: number | null
  checked_at: string
}
