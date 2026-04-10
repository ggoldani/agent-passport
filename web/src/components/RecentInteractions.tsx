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
      <p className="eyebrow">Recent interactions</p>
      <ul className="list-reset stack-sm">
        {interactions.map((interaction) => (
          <li className="list-row" key={interaction.txHash}>
            <span>
              <strong>{interaction.asset}</strong>
              <span className="row-subtle">{interaction.consumerAddress}</span>
              <span className="row-subtle">{interaction.occurredAt}</span>
            </span>
            <span>
              <span className="metric-chip">{interaction.amount}</span>
              <span className="row-subtle">{formatRating(interaction.ratingScore)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
