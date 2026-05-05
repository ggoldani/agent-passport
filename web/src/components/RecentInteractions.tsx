import { formatAddressCompact, formatUtcTimestamp, formatXlmAmount } from "../lib/format";
import type { AgentInteractionSummary } from "../types";

type RecentInteractionsProps = {
  interactions: AgentInteractionSummary[];
};

function formatRating(score: number | null): string {
  if (score === null) {
    return "Unrated";
  }

  return `Rated ${score}`;
}

export function RecentInteractions({ interactions }: RecentInteractionsProps) {
  if (interactions.length === 0) {
    return (
      <section className="rounded border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Recent interactions</p>
        <p className="text-muted">No recent verified interactions yet. This is normal for a fresh agent profile.</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Recent interactions</p>
          <h2 className="font-heading text-2xl leading-tight text-foreground">Verified settlement log</h2>
        </div>
        <p className="text-muted">Newest records appear first.</p>
      </div>
      <ul className="grid gap-3 list-none p-0 m-0">
        {interactions.map((interaction) => (
          <li className="flex items-center justify-between gap-4 rounded border border-border bg-gradient-to-b from-surface/70 to-surface-strong/60 px-4 py-4 max-[720px]:grid max-[720px]:gap-3" key={interaction.txHash}>
            <span className="flex items-start gap-3">
              <strong>{interaction.asset}</strong>
              <span className="mt-1 block font-mono text-sm tracking-wide text-muted" title={interaction.consumerAddress}>
                {formatAddressCompact(interaction.consumerAddress)}
              </span>
              <span className="mt-1 block text-sm text-muted">{formatUtcTimestamp(interaction.occurredAt)}</span>
            </span>
            <span className="grid justify-items-end gap-1">
              <span className="inline-flex items-center rounded-full border border-accent/25 bg-accent/12 px-3 py-1 font-mono text-sm font-bold tracking-wide text-accent">{formatXlmAmount(interaction.amount)}</span>
              <span className="text-sm text-muted">{formatRating(interaction.ratingScore)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
