import { z } from "zod";
import { apiFetch } from "./client.js";

export const searchSchema = z.object({
  q: z.string().optional().describe("Full-text search query"),
  tags: z.string().optional().describe("Comma-separated tags to filter"),
  minScore: z.number().int().min(0).max(100).optional().describe("Minimum score filter"),
  maxScore: z.number().int().min(0).max(100).optional().describe("Maximum score filter"),
  sortBy: z.enum(["score", "interactions", "volume", "newest", "relevance"]).optional().describe("Sort field"),
  limit: z.number().int().min(1).max(50).optional().describe("Results per page (1-50)"),
});

export type SearchParams = z.infer<typeof searchSchema>;

interface AgentResponse {
  owner_address: string;
  name: string;
  description: string;
  tags: string;
  score: number;
  verified_interactions_count: number;
  trust_tier: string;
}

interface PaginatedResponse {
  data: AgentResponse[];
  total: number;
  has_more: boolean;
}

export async function agentSearch(params: SearchParams): Promise<PaginatedResponse> {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.tags) query.tags = params.tags;
  if (params.minScore !== undefined) query.minScore = String(params.minScore);
  if (params.maxScore !== undefined) query.maxScore = String(params.maxScore);
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.limit !== undefined) query.limit = String(params.limit);

  return apiFetch<PaginatedResponse>("/agents", query);
}
