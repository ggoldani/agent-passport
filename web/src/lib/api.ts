import {
  BASE_FEE,
  Keypair,
  nativeToScVal,
  Operation,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

import {
  AgentPassportClient,
  type AgentPassportMethodArgs,
  type AgentPassportMethodResult,
  type AgentPassportReadMethodName,
  type AgentPassportTransport,
} from "../../../src/sdk/agent-passport";
import type { AgentProfile } from "../../../src/sdk/types";
import type { AgentDashboardDetail, AgentLeaderboardEntry } from "../types";

type DashboardRuntimeConfig = {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  sourceAddress: string;
};

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
): ReturnType<typeof nativeToScVal>[] {
  switch (method) {
    case "get_agent":
    case "list_agent_interactions":
      return [nativeToScVal(args[0], { type: "address" })];
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

function mapProfileToLeaderboardEntry(profile: AgentProfile): AgentLeaderboardEntry {
  return {
    ownerAddress: profile.owner_address,
    name: profile.name,
    description: profile.description.length === 0 ? null : profile.description,
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
  void ownerAddress;
  return null;
}
