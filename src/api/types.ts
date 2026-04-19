import type { agents as agentsTable } from "../indexer/db/schema.js"

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  has_more: boolean
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

function safeJsonParse(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function formatAgent(a: typeof agentsTable.$inferSelect): AgentResponse {
  return {
    owner_address: a.owner_address,
    name: a.name,
    description: a.description,
    tags: safeJsonParse(a.tags),
    score: a.score,
    verified_interactions_count: Number(a.verified_interactions_count),
    total_economic_volume: a.total_economic_volume,
    unique_counterparties_count: Number(a.unique_counterparties_count),
    last_interaction_timestamp: a.last_interaction_timestamp ? Number(a.last_interaction_timestamp) : null,
    created_at: Number(a.created_at),
    service_url: a.service_url,
    mcp_server_url: a.mcp_server_url,
    payment_endpoint: a.payment_endpoint,
  }
}
