declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  stdin: {
    isTTY?: boolean
    setEncoding(encoding: string): void
    on(event: "data", listener: (chunk: string) => void): void
    on(event: "end", listener: () => void): void
    on(event: "error", listener: (error: unknown) => void): void
  }
  stdout: {
    write(chunk: string): boolean
  }
  exitCode?: number
}

import {
  createProviderHookPayload,
  type ProviderWorkerHandshakeInput,
} from "./lib/provider-hook"
import { fetchHorizonTransactionByHash } from "./lib/horizon"
import {
  encodeWorkerInteractionPayload,
  type WorkerInteractionPayload,
} from "./lib/payload"

const TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
const OFFICIAL_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org"

export interface WorkerBootstrapFailureResult {
  ok: false
  kind: "worker.bootstrap.result"
  error: {
    code:
      | "invalid_json"
      | "invalid_payload"
      | "verification_unavailable"
      | "verification_failed"
      | "unexpected_error"
    message: string
  }
}

export interface WorkerHorizonVerification {
  kind: "horizon.transaction"
  transactionHash: string
  ledger: number
  createdAt: string
  sourceAccount: string
}

export interface WorkerBootstrapSuccessResult {
  ok: true
  kind: "worker.bootstrap.result"
  payload: WorkerInteractionPayload
  encodedPayload: string
  verification: WorkerHorizonVerification
}

export type WorkerBootstrapResult =
  | WorkerBootstrapFailureResult
  | WorkerBootstrapSuccessResult

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

class WorkerVerificationFailedError extends Error {}
class WorkerVerificationUnavailableError extends Error {}

function readStringField(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  const fieldValue = value[fieldName]

  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    throw new Error(`Expected ${String(fieldName)} to be a non-empty string`)
  }

  return fieldValue
}

function readOptionalStringField(
  value: Record<string, unknown>,
  fieldName: "serviceLabel",
): string | undefined {
  const fieldValue = value[fieldName]

  if (fieldValue === undefined) {
    return undefined
  }

  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string when provided`)
  }

  return fieldValue
}

export function parseWorkerInteractionPayload(
  rawPayload: unknown,
): ProviderWorkerHandshakeInput {
  if (!isRecord(rawPayload)) {
    throw new Error("Expected the worker handoff payload to be an object")
  }

  const paidRequest = rawPayload.paidRequest
  if (!isRecord(paidRequest)) {
    throw new Error("Expected paidRequest to be an object")
  }

  const payload: ProviderWorkerHandshakeInput = {
    providerAddress: readStringField(rawPayload, "providerAddress"),
    paidRequest: {
      consumerAddress: readStringField(paidRequest, "consumerAddress"),
      txHash: readStringField(paidRequest, "txHash"),
    },
    amount: readStringField(rawPayload, "amount"),
    asset: readStringField(rawPayload, "asset"),
    occurredAt: readStringField(rawPayload, "occurredAt"),
  }

  const serviceLabel = readOptionalStringField(rawPayload, "serviceLabel")
  if (serviceLabel !== undefined) {
    payload.serviceLabel = serviceLabel
  }

  return payload
}

function resolveHorizonBaseUrl(env: Record<string, string | undefined>): string {
  const configuredBaseUrl = env.STELLAR_HORIZON_URL?.trim()

  if (configuredBaseUrl !== undefined && configuredBaseUrl.length > 0) {
    return configuredBaseUrl
  }

  const networkPassphrase = env.STELLAR_NETWORK_PASSPHRASE?.trim()

  if (networkPassphrase === TESTNET_NETWORK_PASSPHRASE) {
    return OFFICIAL_TESTNET_HORIZON_URL
  }

  throw new WorkerVerificationUnavailableError(
    "Expected STELLAR_HORIZON_URL or the official Stellar testnet passphrase to resolve Horizon verification",
  )
}

async function verifyWorkerInteractionPayload(
  payload: WorkerInteractionPayload,
): Promise<WorkerHorizonVerification> {
  const horizonBaseUrl = resolveHorizonBaseUrl(process.env)

  let transaction: Awaited<ReturnType<typeof fetchHorizonTransactionByHash>>

  try {
    transaction = await fetchHorizonTransactionByHash(horizonBaseUrl, payload.txHash)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("Invalid transaction hash:")) {
        throw error
      }

      if (error.message.includes(": 404 ")) {
        throw new WorkerVerificationFailedError(error.message)
      }

      throw new WorkerVerificationUnavailableError(error.message)
    }

    throw new WorkerVerificationUnavailableError(
      "Unexpected Horizon verification failure",
    )
  }

  if (!transaction.successful) {
    throw new WorkerVerificationFailedError(
      `Horizon transaction ${transaction.hash} is not successful`,
    )
  }

  return {
    kind: "horizon.transaction",
    transactionHash: transaction.hash,
    ledger: transaction.ledger,
    createdAt: transaction.createdAt,
    sourceAccount: transaction.sourceAccount,
  }
}

export async function buildWorkerBootstrapResult(
  rawPayload: unknown,
): Promise<WorkerBootstrapResult> {
  try {
    const handoff = parseWorkerInteractionPayload(rawPayload)
    const payload = createProviderHookPayload(handoff)
    const verification = await verifyWorkerInteractionPayload(payload)

    return {
      ok: true,
      kind: "worker.bootstrap.result",
      payload,
      encodedPayload: encodeWorkerInteractionPayload(payload),
      verification,
    }
  } catch (error) {
    return {
      ok: false,
      kind: "worker.bootstrap.result",
      error: {
        code:
          error instanceof SyntaxError
            ? "invalid_json"
            : error instanceof WorkerVerificationUnavailableError
              ? "verification_unavailable"
            : error instanceof WorkerVerificationFailedError
              ? "verification_failed"
            : error instanceof Error
              ? "invalid_payload"
              : "unexpected_error",
        message:
          error instanceof Error ? error.message : "Unexpected worker bootstrap failure",
      },
    }
  }
}

async function readStdinText(): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let text = ""

    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      text += chunk
    })
    process.stdin.on("end", () => {
      resolve(text)
    })
    process.stdin.on("error", (error) => {
      reject(error)
    })
  })
}

function parseInputText(inputText: string): unknown {
  const trimmedInput = inputText.trim()

  if (trimmedInput.length === 0) {
    throw new Error("Expected a JSON payload on stdin or argv[2]")
  }

  return JSON.parse(trimmedInput) as unknown
}

export async function main(): Promise<WorkerBootstrapResult> {
  const cliInput = process.argv[2]

  try {
    if (cliInput === undefined && process.stdin.isTTY) {
      throw new Error("Expected a JSON payload on stdin or argv[2]")
    }

    const rawPayload =
      cliInput !== undefined ? parseInputText(cliInput) : parseInputText(await readStdinText())
    const result = await buildWorkerBootstrapResult(rawPayload)

    process.stdout.write(`${JSON.stringify(result)}\n`)

    if (!result.ok) {
      process.exitCode = 1
    }

    return result
  } catch (error) {
    const result: WorkerBootstrapFailureResult = {
      ok: false,
      kind: "worker.bootstrap.result",
      error: {
        code:
          error instanceof SyntaxError
            ? "invalid_json"
            : error instanceof Error
              ? "invalid_payload"
              : "unexpected_error",
        message:
          error instanceof Error ? error.message : "Unexpected worker bootstrap failure",
      },
    }

    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exitCode = 1

    return result
  }
}

if (process.argv[1]?.endsWith("scripts/worker/index.ts")) {
  void main()
}
