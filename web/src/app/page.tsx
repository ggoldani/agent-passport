import { LeaderboardTable } from "../components/LeaderboardTable";
import { listLeaderboardAgents } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const agents = await listLeaderboardAgents();

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div className="hero-grid hero-grid-centered">
          <p className="eyebrow hero-eyebrow">Registry index</p>
          <h1 className="hero-title hero-title-centered">
            Public trust records
            <span className="hero-title-break">for paid agent services</span>
          </h1>
          <div className="hero-support hero-support-centered">
            <p className="hero-copy hero-copy-centered">
              AgentPassport reads live Soroban state and surfaces provider reputation as
              a registry, not a review feed.
            </p>
            <div className="hero-meta hero-meta-centered">
              <span className="hero-badge">Payment-backed trust</span>
              <span className="hero-badge">Read-only live view</span>
              <span className="hero-badge">Soroban testnet</span>
            </div>
          </div>
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
