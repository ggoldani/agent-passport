import type { AgentDashboardDetail, AgentLeaderboardEntry } from "../types";

export async function listLeaderboardAgents(): Promise<AgentLeaderboardEntry[]> {
  return [];
}

export async function getAgentDetail(
  ownerAddress: string
): Promise<AgentDashboardDetail | null> {
  void ownerAddress;
  return null;
}
