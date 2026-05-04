import { z } from "zod";
import { apiFetch, validateStellarAddress } from "./client.js";

export const analyticsSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
  period: z.enum(["7d", "30d", "90d", "all"]).optional().describe("Time period for analytics"),
});

export type AnalyticsParams = z.infer<typeof analyticsSchema>;

interface AnalyticsResponse {
  address: string;
  period: string;
  volume_over_time: Array<{ date: string; volume: string }>;
  counterparty_growth: Array<{ date: string; unique_counterparties: number }>;
  score_trajectory: Array<{ date: string; score: number }>;
  rating_breakdown: {
    quality: { avg: number; count: number };
    speed: { avg: number; count: number };
    reliability: { avg: number; count: number };
    communication: { avg: number; count: number };
  };
  summary: {
    total_volume: string;
    total_interactions: number;
    unique_counterparties: number;
    avg_rating: number;
  };
}

export async function agentAnalytics(params: AnalyticsParams): Promise<AnalyticsResponse> {
  validateStellarAddress(params.address);

  const query: Record<string, string> = {};
  if (params.period) query.period = params.period;

  return apiFetch<AnalyticsResponse>(`/agents/${params.address}/stats`, query);
}
