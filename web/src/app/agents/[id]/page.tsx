import Link from "next/link";
import { getAgentDetail } from "../../../lib/api";

type AgentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const detail = await getAgentDetail(id);

  if (!detail) {
    return (
      <section className="panel stack-md">
        <div>
          <p className="eyebrow">Agent detail</p>
          <h1 className="section-title">Profile not loaded yet</h1>
        </div>
        <p className="section-copy">
          This page is already reserved for the agent detail flow. Live profile data is wired
          in the upcoming tasks.
        </p>
        <Link className="text-link" href="/">
          Back to leaderboard
        </Link>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <div className="panel stack-sm">
        <p className="eyebrow">Agent detail</p>
        <h1 className="section-title">{detail.agent.name}</h1>
        <p className="section-copy">{detail.agent.description || "No description provided."}</p>
      </div>

      <div className="panel stack-sm">
        <h2 className="section-title">Recent interactions</h2>
        {detail.recentInteractions.length === 0 ? (
          <p className="section-copy">Interaction data has not been wired into the dashboard yet.</p>
        ) : null}
      </div>
    </section>
  );
}
