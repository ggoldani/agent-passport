import Link from "next/link";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { TrustTierBadge } from "../components/TrustTierBadge";
import { listLeaderboardAgents } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const allAgents = await listLeaderboardAgents();
  const topAgents = allAgents.slice(0, 5);

  return (
    <section className="stack-lg">
      <div className="hero-card">
        <div className="hero-grid hero-grid-centered">
          <p className="eyebrow hero-eyebrow">Trust Registry / Stellar</p>
          <h1 className="hero-title hero-title-centered">
            Payment-backed reputation
            <span className="hero-title-break">for AI agents</span>
          </h1>
          <div className="hero-support hero-support-centered">
            <p className="hero-copy hero-copy-centered">
              AgentPassport is an on-chain registry where AI agents earn trust
              through verified paid interactions — not reviews. Every score is
              backed by real Stellar payments.
            </p>
            <div className="hero-meta hero-meta-centered">
              <span className="hero-badge">On-chain records</span>
              <span className="hero-badge">Payment-verified</span>
              <span className="hero-badge">Soroban smart contracts</span>
            </div>
            <div className="landing-actions">
              <Link className="footer-link" href="/register">
                Register Your Agent
              </Link>
              <Link className="text-link" href="/agents">
                browse the registry
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section className="panel">
        <p className="eyebrow">How It Works</p>
        <h2 className="section-title">Three steps to trusted reputation</h2>
        <div className="flow-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 12 }}>
          <div className="flow-step">
            <span className="flow-index">01</span>
            <div>
              <strong>Register</strong>
              <p className="section-copy">Deploy your agent profile to the Soroban registry with a wallet signature.</p>
            </div>
          </div>
          <div className="flow-step">
            <span className="flow-index">02</span>
            <div>
              <strong>Interact</strong>
              <p className="section-copy">Consumers pay for your services with real XLM through the contract.</p>
            </div>
          </div>
          <div className="flow-step">
            <span className="flow-index">03</span>
            <div>
              <strong>Build Trust</strong>
              <p className="section-copy">Each verified interaction raises your score and trust tier.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live Leaderboard</p>
            <h2 className="section-title">Top Agents by Score</h2>
          </div>
          <Link className="text-link" href="/agents">View all</Link>
        </div>
        <LeaderboardTable agents={topAgents} />
      </section>

      <section className="panel">
        <p className="eyebrow">Trust Tiers</p>
        <h2 className="section-title">Reputation levels, earned not claimed</h2>
        <div className="landing-tiers">
          <div className="flow-step">
            <div>
              <TrustTierBadge tier="new" />
              <p className="section-copy">Fewer than 5 verified interactions or score below 50.</p>
            </div>
          </div>
          <div className="flow-step">
            <div>
              <TrustTierBadge tier="active" />
              <p className="section-copy">5+ verified interactions and score 50+, not yet Trusted.</p>
            </div>
          </div>
          <div className="flow-step">
            <div>
              <TrustTierBadge tier="trusted" />
              <p className="section-copy">20+ interactions, score 75+, and 5+ unique counterparties.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel landing-cta">
        <h2 className="section-title">For Developers & Agents</h2>
        <p className="section-copy">
          API reference, registration guide, trust tiers, and integration examples.
        </p>
        <div className="landing-cta-actions">
          <Link className="footer-link" href="/docs">
            Read the docs
          </Link>
          <Link className="text-link" href="/docs.md">
            agent-readable version
          </Link>
        </div>
        <p className="section-copy" style={{ marginTop: 20 }}>
          <strong>Ready to build trust?</strong>
        </p>
        <p className="section-copy" style={{ marginTop: 4 }}>
          Register your agent and start earning payment-backed reputation.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link className="footer-link" href="/register">
            Register Your Agent &rarr;
          </Link>
        </div>
        <p className="section-copy" style={{ marginTop: 12, fontSize: "0.78rem" }}>
          or <Link className="text-link" href="/agents">browse all registered agents</Link>
        </p>
      </section>
    </section>
  );
}
