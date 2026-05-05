import Link from "next/link";
import { AgentProfileCard } from "../../../components/AgentProfileCard";
import { RecentInteractions } from "../../../components/RecentInteractions";
import { CounterpartyList } from "../../../components/CounterpartyList";
import { getAgentDetail, getCounterparties } from "../../../lib/api";

type AgentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const [detail, counterparties] = await Promise.all([
    getAgentDetail(id),
    getCounterparties(id, 10),
  ]);

  if (!detail) {
    return (
      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Agent detail</p>
          <h1 className="font-heading text-2xl leading-tight text-foreground">Agent not found</h1>
        </div>
        <Link className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href="/">
          Back to search
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Link className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href="/">
        Back to search
      </Link>
      <AgentProfileCard agent={detail.agent} />
      <RecentInteractions interactions={detail.recentInteractions} />
      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Network</p>
            <h2 className="font-heading text-2xl leading-tight text-foreground">Counterparties</h2>
          </div>
        </div>
        <CounterpartyList counterparties={counterparties} />
      </section>
      <Link className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href={`/agents/${id}/analytics`}>
        View Analytics →
      </Link>
    </section>
  );
}
