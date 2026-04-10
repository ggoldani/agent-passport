import Link from "next/link";
import type { AgentLeaderboardEntry } from "../types";

type LeaderboardTableProps = {
  agents: AgentLeaderboardEntry[];
};

export function LeaderboardTable({ agents }: LeaderboardTableProps) {
  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No providers loaded yet.</p>
        <p className="empty-copy">
          The leaderboard component is ready. Live contract data wiring comes next.
        </p>
      </div>
    );
  }

  return (
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
  );
}
