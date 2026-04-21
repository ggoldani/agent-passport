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
      <section className="panel stack-md">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="section-title">Agent not found</h1>
        </div>
        <Link className="text-link" href="/">
          Back to search
        </Link>
      </section>
    )
  }

  return (
    <section className="stack-lg">
      <Link className="text-link" href={`/agents/${id}`}>
        Back to agent detail
      </Link>
      <AnalyticsPanel agentName={detail.agent.name} initialStats={stats} address={id} />
    </section>
  )
}
