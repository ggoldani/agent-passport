import { z } from "zod";
import { apiFetch, validateStellarAddress } from "./client.js";

export const badgeSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
});

export type BadgeParams = z.infer<typeof badgeSchema>;

interface BadgeStatsResponse {
  address: string;
  name: string;
  trust_tier: string;
  score: number;
  verified_interactions_count: number;
  total_economic_volume: string;
  total_counterparties: number;
}

export async function agentBadgeStats(params: BadgeParams): Promise<BadgeStatsResponse> {
  validateStellarAddress(params.address);

  return apiFetch<BadgeStatsResponse>(`/badge-stats/${params.address}`);
}
