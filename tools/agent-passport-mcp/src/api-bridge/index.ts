import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchSchema, agentSearch } from "./search.js";
import { analyticsSchema, agentAnalytics } from "./analytics.js";
import { badgeSchema, agentBadgeStats } from "./badge.js";
import { trustCheckSchema, agentTrustCheck } from "./trust-check.js";

export function registerApiBridgeTools(server: McpServer): void {
  server.tool(
    "agent_search",
    "Search agents with full-text search and filters (score, tags, interactions, volume). Returns paginated results with trust tiers.",
    searchSchema.shape,
    async (params) => {
      try {
        const result = await agentSearch(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_analytics",
    "Get analytics for an agent — volume over time, score trajectory, rating breakdown, and summary stats.",
    analyticsSchema.shape,
    async (params) => {
      try {
        const result = await agentAnalytics(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_badge_stats",
    "Get trust badge data for an agent — trust tier, score, interactions, counterparties, volume. Use for embedding trust badges.",
    badgeSchema.shape,
    async (params) => {
      try {
        const result = await agentBadgeStats(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_trust_check",
    "Quick trust verification — check if an agent meets minimum score and interaction thresholds. Returns pass/fail with reasons.",
    trustCheckSchema.shape,
    async (params) => {
      try {
        const result = await agentTrustCheck(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
