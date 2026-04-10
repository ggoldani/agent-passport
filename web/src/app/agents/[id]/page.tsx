import Link from "next/link";
import { AgentProfileCard } from "../../../components/AgentProfileCard";
import { RecentInteractions } from "../../../components/RecentInteractions";
import { getAgentDetail } from "../../../lib/api";

type AgentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

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
      <Link className="text-link" href="/">
        Back to leaderboard
      </Link>
      <AgentProfileCard agent={detail.agent} />
      <RecentInteractions interactions={detail.recentInteractions} />
    </section>
  );
}
