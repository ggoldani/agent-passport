import { formatUtcTimestamp, formatXlmAmount } from "../lib/format";
import type { AgentDashboardDetail } from "../types";

type AgentProfileCardProps = {
  agent: AgentDashboardDetail["agent"];
};

function formatLastInteraction(timestamp: string | null): string {
  return formatUtcTimestamp(timestamp);
}

function formatOptionalUrl(url: string | null): string {
  return url ?? "Not provided";
}

export function AgentProfileCard({ agent }: AgentProfileCardProps) {
  return (
    <section className="panel stack-md">
      <div className="registry-head stack-sm">
        <div className="record-stamp">Registry record</div>
        <p className="eyebrow">Agent profile</p>
        <h1 className="section-title">{agent.name}</h1>
        <p className="section-copy">{agent.description || "No description provided."}</p>
      </div>

      <div className="stack-sm">
        <p>
          <strong>Owner address</strong>
        </p>
        <p className="row-subtle row-mono">{agent.ownerAddress}</p>
      </div>

      <div className="stack-sm">
        <p>
          <strong>Tags</strong>
        </p>
        <p className="section-copy">
          {agent.tags.length === 0 ? "No tags provided." : agent.tags.join(" · ")}
        </p>
      </div>

      <div className="stack-sm">
        <p>
          <strong>Service URL</strong>
        </p>
        <p className="section-copy">{formatOptionalUrl(agent.serviceUrl)}</p>
        <p>
          <strong>MCP server URL</strong>
        </p>
        <p className="section-copy">{formatOptionalUrl(agent.mcpServerUrl)}</p>
        <p>
          <strong>Payment endpoint</strong>
        </p>
        <p className="section-copy">{formatOptionalUrl(agent.paymentEndpoint)}</p>
      </div>

      <div className="stack-sm">
        <p>
          <strong>Current trust metrics</strong>
        </p>
        <ul className="list-reset stack-sm metrics-grid">
          <li className="list-row">
            <span>Score</span>
            <span className="metric-chip">{agent.score}</span>
          </li>
          <li className="list-row">
            <span>Verified interactions</span>
            <span className="metric-chip">{agent.verifiedInteractionsCount}</span>
          </li>
          <li className="list-row">
            <span>Total economic volume</span>
            <span className="metric-chip">{formatXlmAmount(agent.totalEconomicVolume)}</span>
          </li>
          <li className="list-row">
            <span>Unique counterparties</span>
            <span className="metric-chip">{agent.uniqueCounterpartiesCount}</span>
          </li>
          <li className="list-row">
            <span>Last interaction</span>
            <span className="metric-chip">{formatLastInteraction(agent.lastInteractionTimestamp)}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
