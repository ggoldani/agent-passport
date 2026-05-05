import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAgentStats, getAgentDetail } from "../../../../lib/api"
import { AnalyticsPanel } from "../../../../components/AnalyticsPanel"
import { buildPageMetadata } from "../../../../lib/seo"

type AnalyticsPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: AnalyticsPageProps): Promise<Metadata> {
  const { id } = await params
  const detail = await getAgentDetail(id)

  if (!detail) {
    return buildPageMetadata({
      title: "Analytics not found — AgentPassport",
      description: "Requested analytics page was not found",
      path: `/agents/${id}/analytics`,
      noindex: true,
    })
  }

  return buildPageMetadata({
    title: `${detail.agent.name} Analytics — AgentPassport`,
    description: `Analytics, score trajectory, and interaction data for ${detail.agent.name}`,
    path: `/agents/${id}/analytics`,
    noindex: true,
  })
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params
  const [detail, stats] = await Promise.all([
    getAgentDetail(id),
    getAgentStats(id),
  ])

  if (!detail) {
    notFound()
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
