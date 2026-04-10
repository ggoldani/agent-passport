import Link from "next/link";
import { formatAddressCompact, formatXlmAmount } from "../lib/format";
import type { AgentLeaderboardEntry } from "../types";

type LeaderboardTableProps = {
  agents: AgentLeaderboardEntry[];
};

export function LeaderboardTable({ agents }: LeaderboardTableProps) {
  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No providers indexed yet.</p>
        <p className="empty-copy">
          No live provider records were returned from the contract.
        </p>
      </div>
    );
  }

  return (
    <ul className="list-reset stack-sm">
      {agents.map((agent, index) => (
        <li key={agent.ownerAddress}>
          <Link className="list-row" href={`/agents/${agent.ownerAddress}`}>
            <span className="row-main">
              <span className="list-rank">#{String(index + 1).padStart(2, "0")}</span>
              <span>
                <strong>{agent.name}</strong>
                <span className="row-subtle row-mono" title={agent.ownerAddress}>
                  {formatAddressCompact(agent.ownerAddress)}
                </span>
                <span className="row-subtle">{formatXlmAmount(agent.totalEconomicVolume)}</span>
              </span>
            </span>
            <span className="metric-chip">Score {agent.score}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
