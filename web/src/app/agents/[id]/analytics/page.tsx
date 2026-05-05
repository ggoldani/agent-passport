import Link from "next/link"
import { getAgentStats, getAgentDetail } from "../../../../lib/api"
import { AnalyticsPanel } from "../../../../components/AnalyticsPanel"

type AnalyticsPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params
  const [detail, stats] = await Promise.all([
    getAgentDetail(id),
    getAgentStats(id),
  ])

  if (!detail) {
    return (
      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Analytics</p>
          <h1 className="font-heading text-2xl leading-tight text-foreground">Agent not found</h1>
        </div>
        <Link className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href="/">
          Back to search
        </Link>
      </section>
    )
  }

  return (
    <section className="grid gap-6">
      <Link className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href={`/agents/${id}`}>
        Back to agent detail
      </Link>
      <AnalyticsPanel agentName={detail.agent.name} initialStats={stats} address={id} />
    </section>
  )
}
