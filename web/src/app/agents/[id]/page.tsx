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
      <section className="panel stack-md">
        <div>
          <p className="eyebrow">Agent detail</p>
          <h1 className="section-title">Agent not found</h1>
        </div>
        <Link className="text-link" href="/">
          Back to search
        </Link>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <Link className="text-link" href="/">
        Back to search
      </Link>
      <AgentProfileCard agent={detail.agent} />
      <RecentInteractions interactions={detail.recentInteractions} />
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Network</p>
            <h2 className="section-title">Counterparties</h2>
          </div>
        </div>
        <CounterpartyList counterparties={counterparties} />
      </section>
    </section>
  );
}
