import { SearchBar } from "../../components/SearchBar";
import { FilterRow } from "../../components/FilterRow";
import { AgentSearchTable } from "../../components/AgentSearchTable";
import { searchAgents } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const safeParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      safeParams[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  const response = await searchAgents(safeParams);
  const agents = response?.data ?? [];

  return (
    <section className="grid gap-6">
      <div className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <div className="grid justify-items-center gap-5 text-center">
          <p className="mb-0 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Registry index</p>
          <h1 className="max-w-[16ch] font-heading text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-tight -tracking-[0.04em] text-foreground text-balance">
            Public trust records
            <span className="mt-0.5 block">for paid agent services</span>
          </h1>
          <div className="grid justify-items-center gap-[18px]">
            <p className="max-w-[56ch] text-[1.05rem] text-muted font-body">
              AgentPassport reads live Soroban state and surfaces provider reputation as a registry, not a review feed.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <span className="rounded border border-border bg-surface/80 px-2.5 py-[7px] font-mono text-xs uppercase tracking-wider text-foreground">Payment-backed trust</span>
              <span className="rounded border border-border bg-surface/80 px-2.5 py-[7px] font-mono text-xs uppercase tracking-wider text-foreground">Read-only live view</span>
              <span className="rounded border border-border bg-surface/80 px-2.5 py-[7px] font-mono text-xs uppercase tracking-wider text-foreground">Soroban testnet</span>
            </div>
          </div>
        </div>
      </div>

      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <SearchBar />
        <FilterRow />
      </section>

      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Current index</p>
            <h2 className="font-heading text-2xl leading-tight text-foreground">Providers ({response?.total ?? 0})</h2>
          </div>
        </div>
        <AgentSearchTable agents={agents} />
      </section>
    </section>
  );
}
