import { SearchBar } from "../components/SearchBar";
import { FilterRow } from "../components/FilterRow";
import { AgentSearchTable } from "../components/AgentSearchTable";
import { searchAgents } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const response = await searchAgents(params as Record<string, string>)
  const agents = response?.data ?? []

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
        <SearchBar />
        <FilterRow />
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current index</p>
            <h2 className="section-title">Providers ({response?.total ?? 0})</h2>
          </div>
        </div>
        <AgentSearchTable agents={agents} />
      </section>
    </section>
  );
}
