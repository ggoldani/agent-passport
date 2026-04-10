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
      <section className="panel stack-sm">
        <p className="eyebrow">Recent interactions</p>
        <p className="section-copy">
          No recent verified interactions are available for this provider yet.
        </p>
      </section>
    );
  }

  return (
    <section className="panel stack-sm">
      <div className="section-head">
        <div>
          <p className="eyebrow">Recent interactions</p>
          <h2 className="section-title">Verified settlement log</h2>
        </div>
        <p className="section-copy">Newest records appear first.</p>
      </div>
      <ul className="list-reset stack-sm">
        {interactions.map((interaction) => (
          <li className="list-row" key={interaction.txHash}>
            <span className="row-main">
              <strong>{interaction.asset}</strong>
              <span className="row-subtle row-mono" title={interaction.consumerAddress}>
                {formatAddressCompact(interaction.consumerAddress)}
              </span>
              <span className="row-subtle">{formatUtcTimestamp(interaction.occurredAt)}</span>
            </span>
            <span>
              <span className="metric-chip">{formatXlmAmount(interaction.amount)}</span>
              <span className="row-subtle">{formatRating(interaction.ratingScore)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
