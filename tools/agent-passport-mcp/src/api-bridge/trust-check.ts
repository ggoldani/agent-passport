import { z } from "zod";
import { apiFetch, validateStellarAddress } from "./client.js";

export const trustCheckSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
  minScore: z.number().int().min(0).max(100).optional().describe("Minimum trust score required"),
  minInteractions: z.number().int().min(0).optional().describe("Minimum verified interactions required"),
});

export type TrustCheckParams = z.infer<typeof trustCheckSchema>;

interface TrustCheckResponse {
  passed: boolean;
  reasons: string[];
  trust_tier: string;
  score: number;
  verified_interactions_count: number;
}

export async function agentTrustCheck(params: TrustCheckParams): Promise<TrustCheckResponse> {
  validateStellarAddress(params.address);

  const query: Record<string, string> = {};
  if (params.minScore !== undefined) query.minScore = String(params.minScore);
  if (params.minInteractions !== undefined) query.minInteractions = String(params.minInteractions);

  return apiFetch<TrustCheckResponse>(`/trust-check/${params.address}`, query);
}
