declare const process: {
  argv: string[]
  cwd(): string
  env: Record<string, string | undefined>
  exitCode?: number
  stdout: { write(chunk: string): boolean }
  stderr: { write(chunk: string): boolean }
}

import { applyEnvFile } from "../lib/env.js"
import { Buffer } from "node:buffer"

import { StrKey } from "@stellar/stellar-sdk"

import {
  AgentPassportClient,
  SorobanRpcTransport,
} from "../sdk/index.js"
import type {
  Address,
  AgentProfileInput,
  RatingInput,
  RichRatingRecord,
} from "../sdk/types.js"
import { loadRichRatingStore } from "./rich-ratings.js"

function readRequiredEnv(key: string): string {
  const value = process.env[key]
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Environment variable ${key} must not be blank`)
  }
  return normalized
}

function createSdkClient(): AgentPassportClient {
  return new AgentPassportClient({
    contractId: readRequiredEnv("CONTRACT_ID"),
    transport: new SorobanRpcTransport({
      rpcUrl: readRequiredEnv("STELLAR_RPC_URL"),
      networkPassphrase: readRequiredEnv("STELLAR_NETWORK_PASSPHRASE"),
      signerSecretKey: readRequiredEnv("AGENT_SECRET_KEY"),
    }),
  })
}

export const AGENT_PASSPORT_CLI_COMMANDS = [
  "trust_check",
  "agent_register",
  "agent_query",
  "agent_list",
  "agent_rate",
  "agent_interactions",
  "trust_verify",
] as const

export type AgentPassportCliCommand =
  (typeof AGENT_PASSPORT_CLI_COMMANDS)[number]

interface ParsedOptionArgs {
  options: Record<string, string>
  positionals: string[]
}

interface PreparedAgentRegistration {
  ownerAddress: Address
  input: AgentProfileInput
}

interface PreparedAgentQuery {
  ownerAddress: Address
}

interface PreparedAgentList {
  limit: null
}

interface PreparedAgentInteractions {
  providerAddress: Address
}

const AGENT_REGISTER_OPTION_NAMES = [
  "owner-address",
  "name",
  "description",
  "tags",
  "service-url",
  "mcp-server-url",
  "payment-endpoint",
] as const

const AGENT_QUERY_OPTION_NAMES = ["owner-address"] as const
const AGENT_INTERACTIONS_OPTION_NAMES = ["provider-address"] as const
const AGENT_RATE_OPTION_NAMES = [
  "provider-address",
  "consumer-address",
  "interaction-tx-hash",
  "score",
  "quality",
  "speed",
  "reliability",
  "communication",
  "comment",
] as const

function isAgentPassportCliCommand(
  value: string,
): value is AgentPassportCliCommand {
  return AGENT_PASSPORT_CLI_COMMANDS.includes(value as AgentPassportCliCommand)
}

function buildUsage(): string {
  return [
    "Usage: npm run cli -- <command>",
    "",
    "Available commands:",
    ...AGENT_PASSPORT_CLI_COMMANDS.map((command) => `  - ${command}`),
  ].join("\n")
}

function buildAgentRegisterUsage(): string {
  return [
    "Usage: npm run cli -- agent_register --owner-address <G...> --name <name> --description <description> [options]",
    "",
    "Options:",
    "  --tags <tag1,tag2>",
    "  --service-url <https://...>",
    "  --mcp-server-url <https://...>",
    "  --payment-endpoint <https://...>",
  ].join("\n")
}

function buildAgentQueryUsage(): string {
  return [
    "Usage: npm run cli -- agent_query --owner-address <G...>",
  ].join("\n")
}

function buildAgentListUsage(): string {
  return [
    "Usage: npm run cli -- agent_list",
  ].join("\n")
}

function buildAgentRateUsage(): string {
  return [
    "Usage: npm run cli -- agent_rate --provider-address <G...> --consumer-address <G...> --interaction-tx-hash <64-hex> --score <0-100> [options]",
    "",
    "Options:",
    "  --quality <1-5>       Quality dimension (optional)",
    "  --speed <1-5>         Speed dimension (optional)",
    "  --reliability <1-5>   Reliability dimension (optional)",
    "  --communication <1-5> Communication dimension (optional)",
    "  --comment <text>      Optional comment",
  ].join("\n")
}

function buildAgentInteractionsUsage(): string {
  return [
    "Usage: npm run cli -- agent_interactions --provider-address <G...>",
  ].join("\n")
}

function writeStdoutLine(message: string): void {
  process.stdout.write(`${message}\n`)
}

function writeStderrLine(message: string): void {
  process.stderr.write(`${message}\n`)
}

function parseOptionArgs(args: string[]): ParsedOptionArgs {
  const options: Record<string, string> = {}
  const positionals: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (!argument.startsWith("--")) {
      positionals.push(argument)
      continue
    }

    const optionName = argument.slice(2)
    if (optionName.length === 0) {
      throw new Error("Expected a long option name after --")
    }

    const optionValue = args[index + 1]
    if (optionValue === undefined || optionValue.startsWith("--")) {
      throw new Error(`Missing value for option: --${optionName}`)
    }

    if (optionName in options) {
      throw new Error(`Duplicate option: --${optionName}`)
    }

    options[optionName] = optionValue
    index += 1
  }

  return {
    options,
    positionals,
  }
}

function readRequiredOption(
  options: Record<string, string>,
  optionName: string,
): string {
  const value = options[optionName]

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required option: --${optionName}`)
  }

  return value.trim()
}

function readOptionalOption(
  options: Record<string, string>,
  optionName: string,
): string | null {
  const value = options[optionName]

  if (value === undefined) {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Expected --${optionName} to be a non-empty string`)
  }

  return normalized
}

function normalizeTags(rawTags: string | undefined): string[] {
  if (rawTags === undefined) {
    return []
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function parseCommandOptions(
  args: string[],
  commandName:
    | "agent_register"
    | "agent_query"
    | "agent_rate"
    | "agent_interactions",
  allowedOptionNames: readonly string[],
) {
  const { options, positionals } = parseOptionArgs(args)

  if (positionals.length > 0) {
    throw new Error(
      `Unexpected positional arguments for ${commandName}: ${positionals.join(" ")}`,
    )
  }

  for (const optionName of Object.keys(options)) {
    if (!allowedOptionNames.includes(optionName)) {
      throw new Error(`Unknown option for ${commandName}: --${optionName}`)
    }
  }

  return options
}

function parseOwnerAddressOption(options: Record<string, string>): Address {
  const ownerAddress = readRequiredOption(options, "owner-address")

  if (!StrKey.isValidEd25519PublicKey(ownerAddress)) {
    throw new Error(`Invalid Stellar owner address: ${ownerAddress}`)
  }

  return ownerAddress
}

function parseStellarAddressOption(
  options: Record<string, string>,
  optionName: string,
): Address {
  const address = readRequiredOption(options, optionName)

  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`Invalid Stellar address for --${optionName}: ${address}`)
  }

  return address
}

function parseInteractionTxHashOption(options: Record<string, string>): string {
  const txHash = readRequiredOption(options, "interaction-tx-hash").toLowerCase()

  if (!/^[a-f0-9]{64}$/.test(txHash)) {
    throw new Error(
      `Invalid interaction tx hash: expected a 64-character hex string, got ${txHash}`,
    )
  }

  return txHash
}

function parseScoreOption(options: Record<string, string>): number {
  const rawScore = readRequiredOption(options, "score")

  if (!/^[0-9]+$/.test(rawScore)) {
    throw new Error(`Invalid score: expected an integer in 0..100, got ${rawScore}`)
  }

  const score = Number.parseInt(rawScore, 10)
  if (score < 0 || score > 100) {
    throw new Error(`Invalid score: expected an integer in 0..100, got ${rawScore}`)
  }

  return score
}

function parseOptionalScore(
  options: Record<string, string>,
  optionName: string,
): number | undefined {
  const raw = options[optionName]
  if (raw === undefined) return undefined
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`Invalid ${optionName}: expected an integer, got ${raw}`)
  }
  const value = Number.parseInt(raw, 10)
  if (value < 1 || value > 5) {
    throw new Error(`Invalid ${optionName}: expected 1-5, got ${value}`)
  }
  return value
}

function prepareAgentRegistration(args: string[]): PreparedAgentRegistration {
  if (args[0] === "help" || args[0] === "--help") {
    throw new Error(buildAgentRegisterUsage())
  }

  const options = parseCommandOptions(
    args,
    "agent_register",
    AGENT_REGISTER_OPTION_NAMES,
  )
  const ownerAddress = parseOwnerAddressOption(options)

  return {
    ownerAddress,
    input: {
      name: readRequiredOption(options, "name"),
      description: readRequiredOption(options, "description"),
      tags: normalizeTags(options.tags),
      service_url: readOptionalOption(options, "service-url"),
      mcp_server_url: readOptionalOption(options, "mcp-server-url"),
      payment_endpoint: readOptionalOption(options, "payment-endpoint"),
    },
  }
}

function prepareAgentQuery(args: string[]): PreparedAgentQuery {
  if (args[0] === "help" || args[0] === "--help") {
    throw new Error(buildAgentQueryUsage())
  }

  const options = parseCommandOptions(args, "agent_query", AGENT_QUERY_OPTION_NAMES)

  return {
    ownerAddress: parseOwnerAddressOption(options),
  }
}

function prepareAgentList(args: string[]): PreparedAgentList {
  if (args[0] === "help" || args[0] === "--help") {
    throw new Error(buildAgentListUsage())
  }

  const { options, positionals } = parseOptionArgs(args)

  if (Object.keys(options).length > 0) {
    throw new Error(
      `Unknown option for agent_list: --${Object.keys(options)[0]}`,
    )
  }

  if (positionals.length > 0) {
    throw new Error(
      `Unexpected positional arguments for agent_list: ${positionals.join(" ")}`,
    )
  }

  return {
    limit: null,
  }
}

function prepareAgentInteractions(args: string[]): PreparedAgentInteractions {
  if (args[0] === "help" || args[0] === "--help") {
    throw new Error(buildAgentInteractionsUsage())
  }

  const options = parseCommandOptions(
    args,
    "agent_interactions",
    AGENT_INTERACTIONS_OPTION_NAMES,
  )

  return {
    providerAddress: parseStellarAddressOption(options, "provider-address"),
  }
}

function runAgentRegisterCommand(args: string[]): number {
  try {
    const registration = prepareAgentRegistration(args)
    const client = createSdkClient()
    const input: AgentProfileInput = {
      name: registration.input.name,
      description: registration.input.description,
      tags: registration.input.tags,
      service_url: registration.input.service_url,
      mcp_server_url: registration.input.mcp_server_url,
      payment_endpoint: registration.input.payment_endpoint,
    }
    writeStdoutLine(`Registering agent "${input.name}"...`)
    writeStdoutLine(`  Owner: ${registration.ownerAddress}`)
    writeStdoutLine(`  Tags: ${input.tags.join(", ") || "(none)"}`)
    client
      .registerAgent(registration.ownerAddress, input)
      .then(() => {
        writeStdoutLine("Registration submitted successfully.")
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        writeStderrLine(`Registration failed: ${message}`)
        process.exitCode = 1
      })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeStderrLine(message)
    if (message !== buildAgentRegisterUsage()) {
      writeStderrLine("")
      writeStderrLine(buildAgentRegisterUsage())
    }
    return 1
  }
}

function runAgentQueryCommand(args: string[]): number {
  try {
    const query = prepareAgentQuery(args)
    const client = createSdkClient()
    writeStdoutLine(`Querying agent ${query.ownerAddress}...`)
    client
      .getAgent(query.ownerAddress)
      .then((profile) => {
        writeStdoutLine(formatAgentProfile(profile))
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes("get_agent")) {
          writeStdoutLine(`Agent ${query.ownerAddress} not found.`)
        } else {
          writeStderrLine(`Query failed: ${message}`)
          process.exitCode = 1
        }
      })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeStderrLine(message)
    if (message !== buildAgentQueryUsage()) {
      writeStderrLine("")
      writeStderrLine(buildAgentQueryUsage())
    }
    return 1
  }
}

function runAgentListCommand(args: string[]): number {
  try {
    prepareAgentList(args)
    const client = createSdkClient()
    writeStdoutLine("Listing registered agents...")
    client
      .listAgents()
      .then((profiles) => {
        if (profiles.length === 0) {
          writeStdoutLine("No agents registered.")
          return
        }
        writeStdoutLine(`Found ${profiles.length} agent(s):\n`)
        profiles.forEach((profile, index) => {
          writeStdoutLine(`  ${index + 1}. ${profile.name} (${profile.owner_address})`)
          writeStdoutLine(`     Score: ${profile.score} | Interactions: ${profile.verified_interactions_count}`)
          if (profile.description) {
            writeStdoutLine(`     ${profile.description}`)
          }
          writeStdoutLine("")
        })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        writeStderrLine(`List failed: ${message}`)
        process.exitCode = 1
      })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeStderrLine(message)
    if (message !== buildAgentListUsage()) {
      writeStderrLine("")
      writeStderrLine(buildAgentListUsage())
    }
    return 1
  }
}

function runAgentRateCommand(args: string[]): number {
  try {
    const options = parseCommandOptions(args, "agent_rate", AGENT_RATE_OPTION_NAMES)
    const providerAddress = parseStellarAddressOption(options, "provider-address")
    const consumerAddress = parseStellarAddressOption(options, "consumer-address")
    const interactionTxHash = parseInteractionTxHashOption(options)
    const score = parseScoreOption(options)
    const quality = parseOptionalScore(options, "quality")
    const speed = parseOptionalScore(options, "speed")
    const reliability = parseOptionalScore(options, "reliability")
    const communication = parseOptionalScore(options, "communication")
    const comment = readOptionalOption(options, "comment")

    const hasDimensions = quality !== undefined || speed !== undefined || reliability !== undefined || communication !== undefined || comment !== null

    const client = createSdkClient()
    const store = loadRichRatingStore()

    writeStdoutLine(`Submitting rating of ${score} for interaction ${interactionTxHash}...`)
    if (hasDimensions) {
      writeStdoutLine(`  Dimensions: quality=${quality ?? "-"} speed=${speed ?? "-"} reliability=${reliability ?? "-"} communication=${communication ?? "-"}`)
    }

    const ratingInput: RatingInput = {
      provider_address: providerAddress,
      consumer_address: consumerAddress,
      interaction_tx_hash: interactionTxHash,
      score,
    }

    client
      .submitRating(ratingInput)
      .then(() => {
        writeStdoutLine("On-chain rating submitted successfully.")
        if (hasDimensions) {
          store.submit({
            provider_address: providerAddress,
            consumer_address: consumerAddress,
            interaction_tx_hash: interactionTxHash,
            score,
            quality: quality ?? null,
            speed: speed ?? null,
            reliability: reliability ?? null,
            communication: communication ?? null,
            comment: comment ?? null,
            submitted_at: new Date().toISOString(),
          })
          writeStdoutLine("Rich rating dimensions stored locally.")
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        writeStderrLine(`Rating submission failed: ${message}`)
        process.exitCode = 1
      })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeStderrLine(message)
    if (message !== buildAgentRateUsage()) {
      writeStderrLine("")
      writeStderrLine(buildAgentRateUsage())
    }
    return 1
  }
}

function runAgentInteractionsCommand(args: string[]): number {
  try {
    const { providerAddress } = prepareAgentInteractions(args)
    const client = createSdkClient()
    writeStdoutLine(`Querying interactions for ${providerAddress}...`)
    client
      .listAgentInteractions(providerAddress)
      .then((interactions) => {
        if (interactions.length === 0) {
          writeStdoutLine("No interactions found.")
          return
        }
        writeStdoutLine(`Found ${interactions.length} interaction(s):\n`)
        interactions.forEach((interaction, index) => {
          writeStdoutLine(`  ${index + 1}. tx=${interaction.tx_hash}`)
          writeStdoutLine(`     Consumer: ${interaction.consumer_address}`)
          writeStdoutLine(`     Amount: ${interaction.amount} | Timestamp: ${interaction.timestamp}`)
          writeStdoutLine("")
        })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        writeStderrLine(`Query failed: ${message}`)
        process.exitCode = 1
      })
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeStderrLine(message)
    if (message !== buildAgentInteractionsUsage()) {
      writeStderrLine("")
      writeStderrLine(buildAgentInteractionsUsage())
    }
    return 1
  }
}

function formatAgentProfile(profile: {
  name: string
  description: string | null
  owner_address: string
  score: number
  verified_interactions_count: bigint
  total_economic_volume: bigint
  unique_counterparties_count: bigint
  tags: string[]
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
}): string {
  return [
    `Name: ${profile.name}`,
    `Address: ${profile.owner_address}`,
    `Score: ${profile.score}`,
    `Interactions: ${profile.verified_interactions_count}`,
    `Volume: ${profile.total_economic_volume} stroops`,
    `Counterparties: ${profile.unique_counterparties_count}`,
    profile.tags.length > 0 ? `Tags: ${profile.tags.join(", ")}` : null,
    profile.description ? `Description: ${profile.description}` : null,
    profile.service_url ? `Service URL: ${profile.service_url}` : null,
    profile.mcp_server_url ? `MCP URL: ${profile.mcp_server_url}` : null,
    profile.payment_endpoint ? `Payment: ${profile.payment_endpoint}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

function runTrustCheckCommand(args: string[]): number {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    writeStdoutLine("Usage: npm run cli -- trust_check <G...>\n\nQuick trust profile lookup for any Stellar address.")
    return 0
  }

  const address = args[0]
  if (!StrKey.isValidEd25519PublicKey(address)) {
    writeStderrLine(`Invalid Stellar address: ${address}`)
    return 1
  }

  const client = createSdkClient()
  client
    .getAgent(address)
    .then((profile) => {
      writeStdoutLine(`Trust Profile: ${profile.name}\n`)
      writeStdoutLine(formatAgentProfile(profile))
      const store = loadRichRatingStore()
      const richRatings = store.getByProvider(address)
      if (richRatings.length > 0) {
        writeStdoutLine("\nRich Rating Dimensions (off-chain):")
        const avg = (
          field: keyof Pick<RichRatingRecord, "quality" | "speed" | "reliability" | "communication">,
        ) => {
          const values = richRatings
            .map((r) => r[field])
            .filter((v): v is number => v !== null)
          if (values.length === 0) return null
          return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1)
        }
        writeStdoutLine(`  Quality: ${avg("quality") ?? "N/A"} (${richRatings.length} ratings)`)
        writeStdoutLine(`  Speed: ${avg("speed") ?? "N/A"}`)
        writeStdoutLine(`  Reliability: ${avg("reliability") ?? "N/A"}`)
        writeStdoutLine(`  Communication: ${avg("communication") ?? "N/A"}`)
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("get_agent")) {
        writeStdoutLine(`No trust profile found for ${address}.`)
      } else {
        writeStderrLine(`Trust check failed: ${message}`)
        process.exitCode = 1
      }
    })
  return 0
}

function runTrustVerifyCommand(args: string[]): number {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    writeStdoutLine("Usage: npm run cli -- trust_verify <G...> [--threshold 50] [--min-interactions 0]\n\nVerify if an agent meets trust criteria.")
    return 0
  }

  const address = args[0]
  if (!StrKey.isValidEd25519PublicKey(address)) {
    writeStderrLine(`Invalid Stellar address: ${address}`)
    return 1
  }

  const { options, positionals } = parseOptionArgs(args.slice(1))
  if (positionals.length > 0) {
    writeStderrLine(`Unexpected positional arguments: ${positionals.join(" ")}`)
    return 1
  }

  const threshold = Number(options["threshold"] ?? 50)
  const minInteractions = Number(options["min-interactions"] ?? 0)

  const client = createSdkClient()
  client
    .trustCheck(address, { threshold, minInteractions })
    .then((result) => {
      writeStdoutLine(`Trust Check: ${result.name} (${address})`)
      writeStdoutLine(`  Trusted: ${result.trusted ? "YES" : "NO"}`)
      writeStdoutLine(`  Score: ${result.score} / Tier: ${result.trust_tier ?? "N/A"}`)
      writeStdoutLine(`  Interactions: ${result.verified_interactions} | Counterparties: ${result.unique_counterparties}`)
      if (result.last_active) {
        const ago = Math.floor((Date.now() - Number(result.last_active) * 1000) / 86400000)
        writeStdoutLine(`  Last active: ${ago === 0 ? "today" : `${ago} day(s) ago`}`)
      }
      if (!result.trusted) {
        if (result.score < threshold) writeStderrLine(`  Reason: score ${result.score} < threshold ${threshold}`)
        if (result.verified_interactions < minInteractions) writeStderrLine(`  Reason: interactions ${result.verified_interactions} < min ${minInteractions}`)
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      writeStderrLine(`Trust verify failed: ${message}`)
      process.exitCode = 1
    })
  return 0
}

export function runCli(argv: string[]): number {
  applyEnvFile()
  const command = argv[0]

  if (command === undefined || command === "help" || command === "--help") {
    writeStdoutLine(buildUsage())
    return 0
  }

  if (!isAgentPassportCliCommand(command)) {
    writeStderrLine(`Unknown command: ${command}`)
    writeStderrLine("")
    writeStderrLine(buildUsage())
    return 1
  }

  if (command === "trust_check") {
    return runTrustCheckCommand(argv.slice(1))
  }

  if (command === "agent_register") {
    return runAgentRegisterCommand(argv.slice(1))
  }

  if (command === "agent_query") {
    return runAgentQueryCommand(argv.slice(1))
  }

  if (command === "agent_list") {
    return runAgentListCommand(argv.slice(1))
  }

  if (command === "agent_rate") {
    return runAgentRateCommand(argv.slice(1))
  }

  if (command === "agent_interactions") {
    return runAgentInteractionsCommand(argv.slice(1))
  }

  if (command === "trust_verify") {
    return runTrustVerifyCommand(argv.slice(1))
  }

  writeStderrLine(`Command not implemented yet: ${command}`)
  return 1
}

if (process.argv[1]?.endsWith("src/cli/index.ts")) {
  process.exitCode = runCli(process.argv.slice(2))
}
