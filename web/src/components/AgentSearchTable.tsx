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

function scoreToneClass(score: number): string {
  if (score >= 80) return "border-accent/30 bg-accent/15 text-accent shadow-[0_0_10px_rgba(245,158,11,0.15)]"
  if (score >= 40) return "border-amber-500/30 bg-amber-500/12 text-amber-300"
  if (score > 0) return "border-red-500/30 bg-red-500/12 text-red-400"
  return "border-border bg-surface text-muted"
}

export function AgentSearchTable({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-surface/40 p-5">
        <p className="font-heading font-semibold text-foreground">No agents found</p>
        <p className="mt-1.5 text-muted">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {agents.map((agent) => (
        <Link key={agent.owner_address} href={`/agents/${agent.owner_address}`} className="flex items-center justify-between gap-4 rounded border border-border bg-gradient-to-b from-surface/70 to-surface-strong/60 px-4 py-4 transition-all hover:-translate-y-px hover:border-accent/40 hover:bg-gradient-to-b hover:from-surface-strong/90 hover:to-surface/90 hover:shadow-[0_12px_28px_rgba(0,0,0,0.3)] max-[720px]:grid max-[720px]:gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 max-[720px]:items-start">
              <strong>{agent.name}</strong>
              <TrustTierBadge tier={agent.trust_tier} />
            </div>
            <p className="mt-1 text-sm text-muted">{agent.description ? agent.description.slice(0, 100) : ""}</p>
            {agent.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {agent.tags.map((tag) => (
                  <span key={tag} className="inline-flex rounded-full border border-border bg-surface px-2 py-1 text-[0.75rem] font-medium text-foreground">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 max-[720px]:flex-wrap max-[720px]:gap-2">
            <div className={`inline-flex min-w-[88px] items-center justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${scoreToneClass(agent.score)}`}>
              {agent.score}
            </div>
            <span className="text-sm text-muted">{agent.verified_interactions_count} interactions</span>
            <span className="text-sm text-muted">{formatRelativeTime(agent.last_interaction_timestamp)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
