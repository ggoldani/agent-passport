import Link from "next/link";
import { formatAddressCompact, formatXlmAmount, getScoreToneClass } from "../lib/format";
import type { AgentLeaderboardEntry } from "../types";

type LeaderboardTableProps = {
  agents: AgentLeaderboardEntry[];
};

export function LeaderboardTable({ agents }: LeaderboardTableProps) {
  if (agents.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-surface/40 p-5">
        <p className="font-heading font-semibold text-foreground">No providers indexed yet.</p>
        <p className="mt-1.5 text-muted">
          No live provider records were returned from the contract.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 list-none p-0 m-0">
      {agents.map((agent, index) => (
        <li key={agent.ownerAddress}>
          <Link className="flex items-center justify-between gap-4 rounded border border-border bg-gradient-to-b from-surface/70 to-surface-strong/60 px-4 py-4 transition-all hover:-translate-y-px hover:border-accent/40 hover:bg-gradient-to-b hover:from-surface-strong/90 hover:to-surface/90 hover:shadow-[0_12px_28px_rgba(0,0,0,0.3)] max-[720px]:grid max-[720px]:gap-3" href={`/agents/${agent.ownerAddress}`}>
            <span className="flex items-start gap-3">
              <span className="min-w-[2.8rem] font-mono text-sm font-bold tracking-wider text-accent">#{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{agent.name}</strong>
                <span className="mt-1 block font-mono text-sm tracking-wide text-muted" title={agent.ownerAddress}>
                  {formatAddressCompact(agent.ownerAddress)}
                </span>
                <span className="mt-1 block text-sm text-muted">{formatXlmAmount(agent.totalEconomicVolume)}</span>
              </span>
            </span>
            <span className={`inline-flex min-w-[88px] items-center justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getScoreToneClass(agent.score)}`}>
              Score {agent.score}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
