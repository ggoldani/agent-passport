import { Buffer } from "node:buffer";

import {
  BASE_FEE,
  Keypair,
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
  const relayerSecretKey = readRequiredServerEnv("RELAYER_SECRET_KEY");
  const sourceAddress = Keypair.fromSecret(relayerSecretKey).publicKey();

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
    case "list_agent_interactions":
      return [nativeToScVal(args[0], { type: "address" })];
    case "get_rating": {
      const [interactionTxHash] = args as AgentPassportMethodArgs["get_rating"];

      return [xdr.ScVal.scvBytes(Buffer.from(interactionTxHash, "hex"))];
    }
    case "get_config":
    case "list_agents":
      return [];
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
  };
}

export async function listLeaderboardAgents(): Promise<AgentLeaderboardEntry[]> {
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
}

export async function getAgentDetail(
  ownerAddress: string
): Promise<AgentDashboardDetail | null> {
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
