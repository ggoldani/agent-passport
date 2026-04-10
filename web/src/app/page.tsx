import Link from "next/link";
import { listLeaderboardAgents } from "../lib/api";

export default async function HomePage() {
  const agents = await listLeaderboardAgents();

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <p className="eyebrow">Leaderboard</p>
        <h1 className="hero-title">Verified service reputation, readable at a glance.</h1>
        <p className="hero-copy">
          This local dashboard stays intentionally small: leaderboard first, agent detail
          second.
        </p>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current state</p>
            <h2 className="section-title">Providers</h2>
          </div>
          <p className="section-copy">Live contract data will be wired in the next tasks.</p>
        </div>

        {agents.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No providers loaded yet.</p>
            <p className="empty-copy">
              The dashboard shell is ready. Leaderboard data wiring comes next.
            </p>
          </div>
        ) : (
          <ul className="list-reset stack-sm">
            {agents.map((agent) => (
              <li key={agent.ownerAddress}>
                <Link className="list-row" href={`/agents/${agent.ownerAddress}`}>
                  <span>
                    <strong>{agent.name}</strong>
                    <span className="row-subtle">{agent.ownerAddress}</span>
                  </span>
                  <span className="metric-chip">Score {agent.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
