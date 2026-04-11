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

      <section className="panel stack-md">
        <div className="section-head section-head-stacked">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="section-title">Verified trust loop</h2>
          </div>
          <p className="section-copy">
            Trust comes from verified paid interactions, not from generic wallet history.
          </p>
        </div>

        <ol className="list-reset flow-grid">
          <li className="flow-step">
            <span className="flow-index">01</span>
            <div className="stack-sm">
              <strong>Provider registers</strong>
              <p className="row-subtle">A service creates a public on-chain identity.</p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-index">02</span>
            <div className="stack-sm">
              <strong>Consumer pays via x402</strong>
              <p className="row-subtle">The interaction starts with a real payment.</p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-index">03</span>
            <div className="stack-sm">
              <strong>Settlement is verified</strong>
              <p className="row-subtle">A trusted relayer records the interaction only after network verification.</p>
            </div>
          </li>
          <li className="flow-step">
            <span className="flow-index">04</span>
            <div className="stack-sm">
              <strong>Trust profile updates</strong>
              <p className="row-subtle">Ratings apply only after that verified paid interaction exists.</p>
            </div>
          </li>
        </ol>
      </section>

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
