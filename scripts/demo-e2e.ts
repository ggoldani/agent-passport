import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  BASE_FEE,
  Keypair,
  nativeToScVal,
  Operation,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk"
import { Server } from "@stellar/stellar-sdk/rpc"

import type { AgentProfile, AgentProfileInput } from "../src/sdk/types"
import {
  loadRelayerConfig,
  type RelayerConfig,
  type RelayerConfigEnv,
} from "./worker/lib/relayer"

declare const process: {
  argv: string[]
  cwd(): string
  env: Record<string, string | undefined>
  exitCode?: number
  stdout: {
    write(chunk: string): boolean
  }
  stderr: {
    write(chunk: string): boolean
  }
}

const DEMO_PROVIDER_NAME = "StellarIntel"
const DEMO_PROVIDER_DESCRIPTION = "Paid Stellar reputation intelligence"
const DEMO_PROVIDER_TAGS = ["stellar", "reputation", "x402"]
const DEMO_TIMEOUT_SECONDS = 30

type DemoStepId =
  | "register-agent-a"
  | "pre-payment-trust-lookup"
  | "paid-stellarintel-call"
  | "automatic-worker-verification"
  | "rating-submission"
  | "post-rating-trust-lookup"

export interface AgentRegistrationStepResult {
  step: "register-agent-a"
  status: "registered" | "already-registered"
  ownerAddress: string
  submissionHash: string | null
  profileMatchesExpectedInput: boolean
  note: string | null
  profile: AgentProfile
}

interface DemoRuntimeConfig extends RelayerConfig {
  providerAddress: string
  providerProfileInput: AgentProfileInput
}

export interface DemoStep {
  id: DemoStepId
  title: string
  narrative: string
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "register-agent-a",
    title: "Register Agent A",
    narrative:
      "Agent A — StellarIntel — registers on AgentPassport and gets a public trust profile.",
  },
  {
    id: "pre-payment-trust-lookup",
    title: "Pre-Payment Trust Lookup",
    narrative:
      "Agent B checks Agent A's public trust profile before deciding to pay.",
  },
  {
    id: "paid-stellarintel-call",
    title: "Paid StellarIntel Call",
    narrative:
      "Agent B pays StellarIntel via x402 for a real premium Stellar intelligence service.",
  },
  {
    id: "automatic-worker-verification",
    title: "Automatic Worker Verification",
    narrative:
      "The relayer verifies the payment and registers the interaction on Soroban.",
  },
  {
    id: "rating-submission",
    title: "Rating Submission",
    narrative:
      "Only after a verified paid interaction can Agent B submit a rating.",
  },
  {
    id: "post-rating-trust-lookup",
    title: "Post-Rating Trust Lookup",
    narrative:
      "Agent A's public trust profile updates immediately after the verified interaction and rating.",
  },
]

function stringifyDemoValue(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) =>
      typeof currentValue === "bigint"
        ? currentValue.toString()
        : currentValue,
    2,
  )
}

function readOptionalEnvVar(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length === 0 ? undefined : normalized
}

function readLocalEnvFile(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env")
  if (!existsSync(envPath)) {
    return {}
  }

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const delimiterIndex = line.indexOf("=")
        if (delimiterIndex === -1) {
          return [line, ""]
        }

        const key = line.slice(0, delimiterIndex).trim()
        const rawValue = line.slice(delimiterIndex + 1).trim()
        const value =
          rawValue.startsWith("\"") && rawValue.endsWith("\"")
            ? rawValue.slice(1, -1)
            : rawValue
        return [key, value]
      }),
  )
}

function loadDemoEnv(
  processEnv: Record<string, string | undefined>,
): Record<string, string | undefined> & RelayerConfigEnv {
  return {
    ...readLocalEnvFile(),
    ...processEnv,
  }
}

function normalizeOptionalAbsoluteUrl(
  value: string | undefined,
  key: string,
): string | null {
  if (value === undefined) {
    return null
  }

  let normalizedUrl: URL
  try {
    normalizedUrl = new URL(value)
  } catch {
    throw new Error(
      `Invalid ${key}: expected an absolute URL, got ${JSON.stringify(value)}`,
    )
  }

  return normalizedUrl.toString()
}

function buildProviderProfileInput(
  env: Record<string, string | undefined>,
): AgentProfileInput {
  const providerUrl = normalizeOptionalAbsoluteUrl(
    readOptionalEnvVar(env, "PROVIDER_URL"),
    "PROVIDER_URL",
  )
  const mcpServerUrl = normalizeOptionalAbsoluteUrl(
    readOptionalEnvVar(env, "STELLAR_MCP_URL"),
    "STELLAR_MCP_URL",
  )

  return {
    name: DEMO_PROVIDER_NAME,
    description: DEMO_PROVIDER_DESCRIPTION,
    tags: [...DEMO_PROVIDER_TAGS],
    service_url: providerUrl,
    mcp_server_url: mcpServerUrl,
    payment_endpoint:
      providerUrl === null
        ? null
        : new URL("/analyze-account", providerUrl).toString(),
  }
}

function profileMatchesInput(
  profile: AgentProfile,
  input: AgentProfileInput,
): boolean {
  return (
    profile.name === input.name &&
    profile.description === input.description &&
    profile.service_url === input.service_url &&
    profile.mcp_server_url === input.mcp_server_url &&
    profile.payment_endpoint === input.payment_endpoint &&
    profile.tags.length === input.tags.length &&
    profile.tags.every((tag, index) => tag === input.tags[index])
  )
}

function loadDemoRuntimeConfig(
  processEnv: Record<string, string | undefined> = process.env,
): DemoRuntimeConfig {
  const env = loadDemoEnv(processEnv)
  const relayerConfig = loadRelayerConfig(env)
  const relayerKeypair = Keypair.fromSecret(relayerConfig.relayerSecretKey)
  const providerAddress = relayerKeypair.publicKey()
  const payTo = readOptionalEnvVar(env, "X402_PAY_TO")

  if (payTo !== undefined && payTo !== providerAddress) {
    throw new Error(
      `Demo registration requires X402_PAY_TO to match the relayer public key, got ${JSON.stringify(payTo)} for ${JSON.stringify(providerAddress)}`,
    )
  }

  return {
    ...relayerConfig,
    providerAddress,
    providerProfileInput: buildProviderProfileInput(env),
  }
}

function buildAgentProfileInputScVal(input: AgentProfileInput): xdr.ScVal {
  const stringEntry = (key: string, value: string): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val: nativeToScVal(value, { type: "string" }),
    })
  const optionalStringEntry = (
    key: string,
    value: string | null,
  ): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val:
        value === null
          ? xdr.ScVal.scvVoid()
          : nativeToScVal(value, { type: "string" }),
    })

  return xdr.ScVal.scvMap([
    stringEntry("name", input.name),
    stringEntry("description", input.description),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tags"),
      val: xdr.ScVal.scvVec(
        input.tags.map((tag) => nativeToScVal(tag, { type: "string" })),
      ),
    }),
    optionalStringEntry("service_url", input.service_url),
    optionalStringEntry("mcp_server_url", input.mcp_server_url),
    optionalStringEntry("payment_endpoint", input.payment_endpoint),
  ])
}

async function readContractMethod(
  server: Server,
  config: DemoRuntimeConfig,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const sourceAccount = await server.getAccount(config.providerAddress)
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: config.contractId,
        function: method,
        args,
      }),
    )
    .setTimeout(DEMO_TIMEOUT_SECONDS)
    .build()

  const simulation = await server.simulateTransaction(transaction)
  if (!("result" in simulation)) {
    throw new Error(
      `Failed to simulate ${method}: ${"error" in simulation ? simulation.error : "missing result"}`,
    )
  }

  return scValToNative(simulation.result.retval)
}

async function listAgents(
  server: Server,
  config: DemoRuntimeConfig,
): Promise<AgentProfile[]> {
  const result = await readContractMethod(server, config, "list_agents", [])
  if (!Array.isArray(result)) {
    throw new Error(
      `Invalid list_agents result: expected array, got ${JSON.stringify(result)}`,
    )
  }

  return result as AgentProfile[]
}

async function getAgentByOwnerAddress(
  server: Server,
  config: DemoRuntimeConfig,
  ownerAddress: string,
): Promise<AgentProfile> {
  const result = await readContractMethod(server, config, "get_agent", [
    nativeToScVal(ownerAddress, { type: "address" }),
  ])

  return result as AgentProfile
}

async function submitAgentRegistration(
  server: Server,
  config: DemoRuntimeConfig,
): Promise<string> {
  const relayerKeypair = Keypair.fromSecret(config.relayerSecretKey)
  const sourceAccount = await server.getAccount(config.providerAddress)
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: config.contractId,
        function: "register_agent",
        args: [
          nativeToScVal(config.providerAddress, { type: "address" }),
          buildAgentProfileInputScVal(config.providerProfileInput),
        ],
      }),
    )
    .setTimeout(DEMO_TIMEOUT_SECONDS)
    .build()

  const preparedTransaction = await server.prepareTransaction(transaction)
  preparedTransaction.sign(relayerKeypair)

  const submission = await server.sendTransaction(preparedTransaction)
  if (submission.status === "ERROR") {
    throw new Error(
      `sendTransaction failed with status ${submission.status} for ${submission.hash}`,
    )
  }

  const response = await server.pollTransaction(submission.hash, {
    attempts: 20,
  })
  if (response.status !== "SUCCESS") {
    throw new Error(
      `register_agent transaction did not reach SUCCESS: ${response.status}`,
    )
  }

  return submission.hash
}

export async function runAgentRegistrationStep(
  processEnv: Record<string, string | undefined> = process.env,
): Promise<AgentRegistrationStepResult> {
  const config = loadDemoRuntimeConfig(processEnv)
  const server = new Server(config.rpcUrl)
  const existingProfile = (await listAgents(server, config)).find(
    (profile) => profile.owner_address === config.providerAddress,
  )

  if (existingProfile !== undefined) {
    const profileMatchesExpectedInput = profileMatchesInput(
      existingProfile,
      config.providerProfileInput,
    )

    return {
      step: "register-agent-a",
      status: "already-registered",
      ownerAddress: config.providerAddress,
      submissionHash: null,
      profileMatchesExpectedInput,
      note: profileMatchesExpectedInput
        ? null
        : "Existing on-chain profile differs from the current demo profile input; continuing with the existing registration.",
      profile: existingProfile,
    }
  }

  const submissionHash = await submitAgentRegistration(server, config)
  const profile = await getAgentByOwnerAddress(
    server,
    config,
    config.providerAddress,
  )

  return {
    step: "register-agent-a",
    status: "registered",
    ownerAddress: config.providerAddress,
    submissionHash,
    profileMatchesExpectedInput: true,
    note: null,
    profile,
  }
}

export function buildDemoOutline(): string {
  return [
    "AgentPassport demo sequence:",
    ...DEMO_STEPS.map(
      (step, index) => `${index + 1}. ${step.title}: ${step.narrative}`,
    ),
  ].join("\n")
}

export async function runDemo(
  processEnv: Record<string, string | undefined> = process.env,
): Promise<number> {
  process.stdout.write(`${buildDemoOutline()}\n\n`)

  const registrationResult = await runAgentRegistrationStep(processEnv)
  process.stdout.write(`[Step 1/6] ${DEMO_STEPS[0].title}\n`)
  process.stdout.write(`${stringifyDemoValue(registrationResult)}\n`)
  process.stdout.write("\nRemaining steps pending: 5\n")

  return 0
}

if (process.argv[1]?.endsWith("scripts/demo-e2e.ts")) {
  runDemo().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`${message}\n`)
      process.exitCode = 1
    },
  )
}
