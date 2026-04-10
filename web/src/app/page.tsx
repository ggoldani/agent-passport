import { LeaderboardTable } from "../components/LeaderboardTable";
import { listLeaderboardAgents } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const agents = await listLeaderboardAgents();

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <p className="eyebrow">Registry index</p>
        <h1 className="hero-title">Public trust records for paid agent services.</h1>
        <p className="hero-copy">
          AgentPassport reads live Soroban state and surfaces provider reputation as a
          registry, not a review feed.
        </p>
        <div className="hero-meta">
          <span className="hero-badge">Payment-backed trust</span>
          <span className="hero-badge">Read-only live view</span>
          <span className="hero-badge">Soroban testnet</span>
        </div>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current index</p>
            <h2 className="section-title">Providers</h2>
          </div>
          <p className="section-copy">
            Ranked by score, verified interactions, and economic volume.
          </p>
        </div>

        <LeaderboardTable agents={agents} />
      </section>
    </section>
  );
}
