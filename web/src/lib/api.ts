import { Buffer } from "node:buffer";

import {
  BASE_FEE,
  nativeToScVal,
  Operation,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

import {
  AgentPassportClient,
  type AgentPassportMethodArgs,
  type AgentPassportMethodResult,
  type AgentPassportReadMethodName,
  type AgentPassportTransport,
} from "../../../src/sdk/agent-passport";
import type { AgentProfile, InteractionRecord } from "../../../src/sdk/types";
import type { AgentDashboardDetail, AgentLeaderboardEntry } from "../types";
import type { ApiAnalyticsResponse } from "./api-types";

type ApiAgentResponse = {
  owner_address: string
  name: string
  description: string
  tags: string[]
  score: number
  verified_interactions_count: number
  total_economic_volume: string
  unique_counterparties_count: number
  last_interaction_timestamp: number | null
  created_at: number
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
}

type ApiInteractionResponse = {
  provider_address: string
  consumer_address: string
  tx_hash: string
  amount: string
  timestamp: number
  service_label: string | null
}

type ApiRatingResponse = {
  provider_address: string
  consumer_address: string
  interaction_tx_hash: string
  score: number
  timestamp: number
}

type ApiPaginatedResponse<T> = {
  data: T[]
  total: number
  has_more: boolean
}

type ApiAgentResponseEnriched = ApiAgentResponse & {
  trust_tier: string | null
}

type ApiCounterpartyResponse = {
  address: string
  interaction_count: number
  total_volume: string
  is_registered_agent: boolean
}

const API_BASE = process.env.API_URL ?? "http://localhost:3002"

async function fetchFromApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) {
      console.error(`[API] ${res.status} ${res.statusText} for ${path}`)
      return null
    }
    return res.json()
  } catch (err) {
    console.error(`[API] Fetch failed for ${path}:`, err)
    return null
  }
}

function apiAgentToLeaderboardEntry(a: ApiAgentResponseEnriched): AgentLeaderboardEntry {
  return {
    ownerAddress: a.owner_address,
    name: a.name,
    description: normalizeOptionalString(a.description),
    score: a.score,
    verifiedInteractionsCount: a.verified_interactions_count,
    totalEconomicVolume: a.total_economic_volume,
    trustTier: a.trust_tier,
  }
}

function apiAgentToDashboardDetail(a: ApiAgentResponseEnriched, recentInteractions: (ApiInteractionResponse & { ratingScore: number | null })[]): AgentDashboardDetail {
  return {
    agent: {
      ...apiAgentToLeaderboardEntry(a),
      tags: a.tags,
      serviceUrl: normalizeOptionalString(a.service_url),
      mcpServerUrl: normalizeOptionalString(a.mcp_server_url),
      paymentEndpoint: normalizeOptionalString(a.payment_endpoint),
      uniqueCounterpartiesCount: a.unique_counterparties_count,
      lastInteractionTimestamp: a.last_interaction_timestamp ? formatTimestamp(BigInt(a.last_interaction_timestamp)) : null,
    },
    recentInteractions: recentInteractions.map((i) => ({
      txHash: i.tx_hash,
      consumerAddress: i.consumer_address,
      amount: i.amount,
      asset: "XLM",
      occurredAt: formatTimestamp(BigInt(i.timestamp)) ?? "Unknown time",
      ratingScore: i.ratingScore,
    })),
  }
}

type DashboardRuntimeConfig = {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  sourceAddress: string;
};

const MAX_RECENT_INTERACTIONS = 10;

class ReadOnlyAgentPassportTransport implements AgentPassportTransport {
  private readonly config: DashboardRuntimeConfig;
  private readonly server: Server;

  constructor(config: DashboardRuntimeConfig) {
    this.config = config;
    this.server = new Server(config.rpcUrl);
  }

  async read<M extends AgentPassportReadMethodName>(
    contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M]
  ): Promise<AgentPassportMethodResult[M]> {
    const sourceAccount = await this.server.getAccount(this.config.sourceAddress);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args: buildContractArgs(method, args),
        })
      )
      .setTimeout(30)
      .build();

    const simulation = await this.server.simulateTransaction(transaction);
    if (!("result" in simulation)) {
      throw new Error(
        `Failed to simulate ${method}: ${"error" in simulation ? simulation.error : "missing result"}`
      );
    }

    const simulationResult = simulation.result;
    if (simulationResult === undefined) {
      throw new Error(`Failed to simulate ${method}: missing result`);
    }

    return scValToNative(simulationResult.retval) as AgentPassportMethodResult[M];
  }

  async write(): Promise<never> {
    throw new Error("Dashboard transport is read-only");
  }

  async fetchApi<T>(_path: string): Promise<{ data: T; status: number }> {
    throw new Error("fetchApi() is not available via ReadOnlyAgentPassportTransport.");
  }
}

function readRequiredServerEnv(key: string): string {
  const value = process.env[key];

  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Required env var must not be blank: ${key}`);
  }

  return normalized;
}

function loadDashboardRuntimeConfig(): DashboardRuntimeConfig {
  const rpcUrl = readRequiredServerEnv("STELLAR_RPC_URL");
  const contractId = readRequiredServerEnv("CONTRACT_ID");
  const networkPassphrase = readRequiredServerEnv("STELLAR_NETWORK_PASSPHRASE");
  const sourceAddress = readRequiredServerEnv("RELAYER_PUBLIC_KEY");

  if (!sourceAddress) {
    throw new Error("RELAYER_PUBLIC_KEY env var is required");
  }

  return {
    contractId,
    networkPassphrase,
    rpcUrl,
    sourceAddress,
  };
}

function createAgentPassportClient(): AgentPassportClient {
  const config = loadDashboardRuntimeConfig();

  return new AgentPassportClient({
    contractId: config.contractId,
    transport: new ReadOnlyAgentPassportTransport(config),
  });
}

function buildContractArgs<M extends AgentPassportReadMethodName>(
  method: M,
  args: AgentPassportMethodArgs[M]
): xdr.ScVal[] {
  switch (method) {
    case "get_agent":
      return [nativeToScVal(args[0], { type: "address" })];
    case "list_agent_interactions": {
      const [addr] = args as AgentPassportMethodArgs["list_agent_interactions"];
      return [
        nativeToScVal(addr, { type: "address" }),
        nativeToScVal(0, { type: "u32" }),
        nativeToScVal(100, { type: "u32" }),
      ];
    }
    case "get_rating": {
      const [interactionTxHash] = args as AgentPassportMethodArgs["get_rating"];

      return [xdr.ScVal.scvBytes(Buffer.from(interactionTxHash, "hex"))];
    }
    case "get_config":
    case "get_relayers":
      return [];
    case "list_agents":
      return [
        nativeToScVal(0, { type: "u32" }),
        nativeToScVal(100, { type: "u32" }),
      ];
    default: {
      const exhaustiveCheck: never = method;
      throw new Error(`Unsupported dashboard read method: ${String(exhaustiveCheck)}`);
    }
  }
}

function bigintToSafeNumber(value: bigint, field: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${field} exceeds Number.MAX_SAFE_INTEGER`);
  }

  return Number(value);
}

function normalizeOptionalString(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function formatTimestamp(timestamp: bigint): string | null {
  if (timestamp <= 0n) {
    return null;
  }

  return new Date(Number(timestamp) * 1000).toISOString();
}

function normalizeBytes32ToHex(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }

  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return Buffer.from(value).toString("hex");
  }

  throw new Error(
    `Invalid tx hash: expected hex string or byte array, got ${Object.prototype.toString.call(value)}`
  );
}

function mapProfileToLeaderboardEntry(profile: AgentProfile): AgentLeaderboardEntry {
  return {
    ownerAddress: profile.owner_address,
    name: profile.name,
    description: normalizeOptionalString(profile.description),
    score: profile.score,
    verifiedInteractionsCount: bigintToSafeNumber(
      profile.verified_interactions_count,
      "verified_interactions_count"
    ),
    totalEconomicVolume: profile.total_economic_volume.toString(),
    trustTier: null,
  };
}

export async function listLeaderboardAgents(): Promise<AgentLeaderboardEntry[]> {
  try {
    const response = await fetchFromApi<ApiPaginatedResponse<ApiAgentResponseEnriched>>("/agents?limit=100&sort=score&order=desc")
    if (response?.data) {
      return response.data.map(apiAgentToLeaderboardEntry)
    }
  } catch {
  }

  try {
    const client = createAgentPassportClient();
    const profiles = await client.listAgents();

    return profiles
      .map(mapProfileToLeaderboardEntry)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.verifiedInteractionsCount !== left.verifiedInteractionsCount) {
          return right.verifiedInteractionsCount - left.verifiedInteractionsCount;
        }

        const volumeDelta =
          BigInt(right.totalEconomicVolume) - BigInt(left.totalEconomicVolume);
        if (volumeDelta !== 0n) {
          return volumeDelta > 0n ? 1 : -1;
        }

        return left.name.localeCompare(right.name);
      });
  } catch {
    return []
  }
}

export async function getAgentDetail(
  ownerAddress: string
): Promise<AgentDashboardDetail | null> {
  try {
    const agentResponse = await fetchFromApi<ApiAgentResponseEnriched>(`/agents/${ownerAddress}`)
    if (agentResponse) {
      const [interactionsResponse, ratingsResponse] = await Promise.all([
        fetchFromApi<ApiPaginatedResponse<ApiInteractionResponse>>(
          `/agents/${ownerAddress}/interactions?limit=${MAX_RECENT_INTERACTIONS}`
        ),
        fetchFromApi<ApiPaginatedResponse<ApiRatingResponse>>(
          `/agents/${ownerAddress}/ratings?limit=100`
        ),
      ])

      const interactionsList = interactionsResponse?.data ?? []
      const ratingsList = ratingsResponse?.data ?? []
      const ratingsByTxHash = new Map<string, number>()
      for (const r of ratingsList) {
        ratingsByTxHash.set(r.interaction_tx_hash, r.score)
      }

      const recentInteractions = interactionsList.slice(0, MAX_RECENT_INTERACTIONS).map((i) => ({
        ...i,
        ratingScore: ratingsByTxHash.get(i.tx_hash) ?? null,
      }))

      return apiAgentToDashboardDetail(agentResponse, recentInteractions)
    }
  } catch {
  }

  const client = createAgentPassportClient();

  let profile: AgentProfile;
  try {
    profile = await client.getAgent(ownerAddress);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("get_agent")) {
      return null;
    }

    throw error;
  }

  const interactions = await client.listAgentInteractions(ownerAddress);
  const recentInteractions = [...interactions]
    .sort((left, right) => {
      if (right.timestamp === left.timestamp) {
        return 0;
      }

      return right.timestamp > left.timestamp ? 1 : -1;
    })
    .slice(0, MAX_RECENT_INTERACTIONS);
  const recentInteractionsWithRatings = await Promise.all(
    recentInteractions.map(async (interaction) => {
      const txHash = normalizeBytes32ToHex(interaction.tx_hash);
      const rating = await client.getRating(txHash);

      return mapInteractionSummary(interaction, rating?.score ?? null);
    })
  );

  return {
    agent: {
      ...mapProfileToLeaderboardEntry(profile),
      tags: profile.tags,
      serviceUrl: normalizeOptionalString(profile.service_url),
      mcpServerUrl: normalizeOptionalString(profile.mcp_server_url),
      paymentEndpoint: normalizeOptionalString(profile.payment_endpoint),
      uniqueCounterpartiesCount: bigintToSafeNumber(
        profile.unique_counterparties_count,
        "unique_counterparties_count"
      ),
      lastInteractionTimestamp: formatTimestamp(profile.last_interaction_timestamp),
    },
    recentInteractions: recentInteractionsWithRatings,
  };
}

function mapInteractionSummary(
  interaction: InteractionRecord,
  ratingScore: number | null
) {
  return {
    txHash: normalizeBytes32ToHex(interaction.tx_hash),
    consumerAddress: interaction.consumer_address,
    amount: interaction.amount.toString(),
    asset: "XLM",
    occurredAt: formatTimestamp(interaction.timestamp) ?? "Unknown time",
    ratingScore,
  };
}

export async function searchAgents(params: Record<string, string>): Promise<ApiPaginatedResponse<ApiAgentResponseEnriched> | null> {
  const qs = new URLSearchParams(params).toString()
  return fetchFromApi<ApiPaginatedResponse<ApiAgentResponseEnriched>>(`/agents?${qs}`)
}

export async function getCounterparties(address: string, limit = 10): Promise<ApiCounterpartyResponse[]> {
  const response = await fetchFromApi<{ data: ApiCounterpartyResponse[] }>(
    `/agents/${address}/counterparties?limit=${limit}`
  )
  return response?.data ?? []
}

export async function getAgentStats(address: string, period = "30d"): Promise<ApiAnalyticsResponse | null> {
  return fetchFromApi<ApiAnalyticsResponse>(`/agents/${address}/stats?period=${period}`)
}
