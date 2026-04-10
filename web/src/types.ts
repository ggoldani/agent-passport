export type AgentLeaderboardEntry = {
  ownerAddress: string;
  name: string;
  description: string | null;
  score: number;
  verifiedInteractionsCount: number;
  totalEconomicVolume: string;
};

export type AgentInteractionSummary = {
  txHash: string;
  consumerAddress: string;
  amount: string;
  asset: string;
  occurredAt: string;
  ratingScore: number | null;
};

export type AgentDashboardDetail = {
  agent: AgentLeaderboardEntry & {
    tags: string[];
    serviceUrl: string | null;
    mcpServerUrl: string | null;
    paymentEndpoint: string | null;
    uniqueCounterpartiesCount: number;
    lastInteractionTimestamp: string | null;
  };
  recentInteractions: AgentInteractionSummary[];
};
