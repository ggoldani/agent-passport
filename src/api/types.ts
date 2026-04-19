export interface PaginatedResponse<T> {
  data: T[]
  cursor: string | null
  total: number
}

export interface AgentResponse {
  owner_address: string
  name: string
  description: string
  tags: string[]
  score: number
  verified_interactions_count: number
  total_economic_volume: string
  unique_counterparties_count: number
  last_interaction_timestamp: number | null
  created_at: number
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
}

export interface InteractionResponse {
  provider_address: string
  consumer_address: string
  tx_hash: string
  amount: string
  timestamp: number
  service_label: string | null
}

export interface RatingResponse {
  provider_address: string
  consumer_address: string
  interaction_tx_hash: string
  score: number
  timestamp: number
}
