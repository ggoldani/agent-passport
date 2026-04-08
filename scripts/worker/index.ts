declare const process: {
  argv: string[]
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
  encodeWorkerInteractionPayload,
  type WorkerInteractionPayload,
} from "./lib/payload"

export interface WorkerBootstrapFailureResult {
  ok: false
  kind: "worker.bootstrap.result"
  error: {
    code: "invalid_json" | "invalid_payload" | "unexpected_error"
    message: string
  }
}

export interface WorkerBootstrapSuccessResult {
  ok: true
  kind: "worker.bootstrap.result"
  payload: WorkerInteractionPayload
  encodedPayload: string
}

export type WorkerBootstrapResult =
  | WorkerBootstrapFailureResult
  | WorkerBootstrapSuccessResult

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readStringField(
  value: Record<string, unknown>,
  fieldName: keyof WorkerInteractionPayload,
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
): WorkerInteractionPayload {
  if (!isRecord(rawPayload)) {
    throw new Error("Expected the worker handoff payload to be an object")
  }

  const payload: WorkerInteractionPayload = {
    providerAddress: readStringField(rawPayload, "providerAddress"),
    consumerAddress: readStringField(rawPayload, "consumerAddress"),
    txHash: readStringField(rawPayload, "txHash"),
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

function normalizeWorkerInteractionPayload(
  payload: WorkerInteractionPayload,
): WorkerInteractionPayload {
  return payload.serviceLabel === undefined
    ? {
        providerAddress: payload.providerAddress,
        consumerAddress: payload.consumerAddress,
        txHash: payload.txHash,
        amount: payload.amount,
        asset: payload.asset,
        occurredAt: payload.occurredAt,
      }
    : {
        providerAddress: payload.providerAddress,
        consumerAddress: payload.consumerAddress,
        txHash: payload.txHash,
        amount: payload.amount,
        asset: payload.asset,
        occurredAt: payload.occurredAt,
        serviceLabel: payload.serviceLabel,
      }
}

export function buildWorkerBootstrapResult(
  rawPayload: unknown,
): WorkerBootstrapResult {
  try {
    const payload = parseWorkerInteractionPayload(rawPayload)
    const normalizedPayload = normalizeWorkerInteractionPayload(payload)

    return {
      ok: true,
      kind: "worker.bootstrap.result",
      payload: normalizedPayload,
      encodedPayload: encodeWorkerInteractionPayload(normalizedPayload),
    }
  } catch (error) {
    return {
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
    const result = buildWorkerBootstrapResult(rawPayload)

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
