import Link from "next/link"
import { TrustTierBadge } from "./TrustTierBadge"

type Agent = {
  owner_address: string
  name: string
  description: string
  tags: string[]
  score: number
  verified_interactions_count: number
  total_economic_volume: string
  unique_counterparties_count: number
  last_interaction_timestamp: number | null
  trust_tier: string | null
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never"
  const diffDays = Math.floor((Date.now() - Number(timestamp) * 1000) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "1 day ago"
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month(s) ago`
  return `${Math.floor(diffDays / 365)} year(s) ago`
}

function scoreChipClass(score: number): string {
  if (score >= 80) return "score-chip-high"
  if (score >= 40) return "score-chip-medium"
  return "score-chip-low"
}

export function AgentSearchTable({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No agents found</p>
        <p className="empty-copy">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="list-reset">
      {agents.map((agent) => (
        <Link key={agent.owner_address} href={`/agents/${agent.owner_address}`} className="list-row" style={{ textDecoration: "none" }}>
          <div className="row-main" style={{ flex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{agent.name}</strong>
                <TrustTierBadge tier={agent.trust_tier} />
              </div>
              <p className="row-subtle">{agent.description ? agent.description.slice(0, 100) : ""}</p>
              {agent.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                  {agent.tags.map((tag) => (
                    <span key={tag} className="metric-chip" style={{ fontSize: "0.75rem" }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className={`metric-chip score-chip ${scoreChipClass(agent.score)}`}>
              {agent.score}
            </div>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {agent.verified_interactions_count} interactions
            </span>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {formatRelativeTime(agent.last_interaction_timestamp)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
