import { formatUtcTimestamp, formatXlmAmount } from "../lib/format";
import type { AgentDashboardDetail } from "../types";

type AgentProfileCardProps = {
  agent: AgentDashboardDetail["agent"];
};

function formatOptionalUrl(url: string | null): string {
  return url ?? "Not provided";
}

export function AgentProfileCard({ agent }: AgentProfileCardProps) {
  const scoreToneClass =
    agent.score >= 80
      ? "border-accent/30 bg-accent/15 text-accent"
      : agent.score >= 40
        ? "border-amber-500/30 bg-amber-500/12 text-amber-300"
        : agent.score > 0
          ? "border-red-500/30 bg-red-500/12 text-red-400"
          : "border-border bg-surface text-muted";

  return (
    <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="grid gap-4">
        <div>
          <div className="inline-flex rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[0.74rem] font-bold uppercase tracking-[0.08em] text-accent">
            Registry record
          </div>
          <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Agent profile</p>
          <h1 className="font-heading text-3xl font-semibold leading-tight text-foreground">{agent.name}</h1>
          <p className="mt-2 text-muted">{agent.description || "No description provided."}</p>
        </div>

        <div className="grid gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Owner address</p>
            <p className="mt-1 break-all font-mono text-sm text-muted">{agent.ownerAddress}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Tags</p>
            <p className="mt-1 text-sm text-muted">{agent.tags.length === 0 ? "No tags provided." : agent.tags.join(" · ")}</p>
          </div>

          <div className="grid gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Service URL</p>
              <p className="mt-1 text-sm text-muted">{formatOptionalUrl(agent.serviceUrl)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">MCP server URL</p>
              <p className="mt-1 text-sm text-muted">{formatOptionalUrl(agent.mcpServerUrl)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Payment endpoint</p>
              <p className="mt-1 text-sm text-muted">{formatOptionalUrl(agent.paymentEndpoint)}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold text-foreground">Current trust metrics</p>
            <ul className="grid gap-2 p-0 list-none">
              <li className="flex items-center justify-between rounded border border-border bg-surface/50 px-4 py-3">
                <span>Score</span>
                <span className={`inline-flex rounded-full border px-3 py-1 font-mono text-sm font-bold tracking-wide ${scoreToneClass}`}>{agent.score}</span>
              </li>
              <li className="flex items-center justify-between rounded border border-border bg-surface/50 px-4 py-3">
                <span>Verified interactions</span>
                <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-sm font-bold tracking-wide text-foreground">{agent.verifiedInteractionsCount}</span>
              </li>
              <li className="flex items-center justify-between rounded border border-border bg-surface/50 px-4 py-3">
                <span>Total economic volume</span>
                <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-sm font-bold tracking-wide text-foreground">{formatXlmAmount(agent.totalEconomicVolume)}</span>
              </li>
              <li className="flex items-center justify-between rounded border border-border bg-surface/50 px-4 py-3">
                <span>Unique counterparties</span>
                <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-sm font-bold tracking-wide text-foreground">{agent.uniqueCounterpartiesCount}</span>
              </li>
              <li className="flex items-center justify-between rounded border border-border bg-surface/50 px-4 py-3">
                <span>Last interaction</span>
                <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-sm font-bold tracking-wide text-foreground">{formatUtcTimestamp(agent.lastInteractionTimestamp)}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
