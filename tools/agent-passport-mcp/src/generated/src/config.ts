import { Networks, StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";

const EnvSchema = z.object({
  STELLAR_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),
  STELLAR_RPC_URL: z.string().url().optional(),
  STELLAR_HORIZON_URL: z.string().url().optional(),
  STELLAR_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(30_000).default(30_000),
  STELLAR_CONTRACT_ID: z
    .string()
    .trim()
    .min(1)
    .refine((value) => StrKey.isValidContract(value), {
      message: "Invalid Soroban contract id (expected C... contract strkey)."
    }),
  STELLAR_SECRET_KEY: z.string().optional(),
  STELLAR_AUTO_SIGN_POLICY: z.enum(["safe", "guarded", "expert"]).optional(),
  STELLAR_AUTO_SIGN: z.coerce.boolean().default(false),
  STELLAR_AUTO_SIGN_LIMIT: z.coerce.number().min(0).default(0)
});

export type AutoSignPolicy = "safe" | "guarded" | "expert";

export interface AppConfig {
  network: "mainnet" | "testnet";
  rpcUrl?: string;
  horizonUrl?: string;
  requestTimeoutMs: number;
  contractId: string;
  secretKey?: string;
  autoSignPolicy?: AutoSignPolicy;
  autoSign: boolean;
  autoSignLimit: number;
  networkPassphrase: string;
}

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  const env = parsed.data;
  const passphrase =
    env.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  return {
    network: env.STELLAR_NETWORK,
    rpcUrl: env.STELLAR_RPC_URL,
    horizonUrl: env.STELLAR_HORIZON_URL,
    requestTimeoutMs: env.STELLAR_REQUEST_TIMEOUT_MS,
    contractId: env.STELLAR_CONTRACT_ID,
    secretKey: env.STELLAR_SECRET_KEY,
    autoSignPolicy: env.STELLAR_AUTO_SIGN_POLICY,
    autoSign: env.STELLAR_AUTO_SIGN,
    autoSignLimit: env.STELLAR_AUTO_SIGN_LIMIT,
    networkPassphrase: passphrase
  };
}
