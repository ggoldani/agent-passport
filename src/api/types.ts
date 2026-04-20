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
  trust_tier: "new" | "active" | "trusted"
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
    trust_tier: computeTrustTier(
      Number(a.verified_interactions_count),
      a.score,
      Number(a.unique_counterparties_count),
    ),
  }
}

export function computeTrustTier(
  interactions: number,
  score: number,
  counterparties: number,
): "new" | "active" | "trusted" {
  if (interactions < 5 || score < 50) return "new"
  if (interactions >= 20 && score >= 75 && counterparties >= 5) return "trusted"
  return "active"
}

export interface TrustCheckResponse {
  trusted: boolean
  address: string
  name: string
  score: number
  trust_tier: "new" | "active" | "trusted"
  verified_interactions: number
  unique_counterparties: number
  last_active: number | null
  checked_at: string
}

export interface CounterpartyResponse {
  address: string
  interaction_count: number
  total_volume: string
  is_registered_agent: boolean
}
