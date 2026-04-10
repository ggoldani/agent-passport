import { LeaderboardTable } from "../components/LeaderboardTable";
import { listLeaderboardAgents } from "../lib/api";

export const dynamic = "force-dynamic";

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
          <p className="section-copy">Live contract data is now read directly from Soroban testnet.</p>
        </div>

        <LeaderboardTable agents={agents} />
      </section>
    </section>
  );
}
