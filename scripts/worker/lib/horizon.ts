export interface HorizonTransaction {
  hash: string
  successful: boolean
  ledger: number
  createdAt: string
  sourceAccount: string
  sourceAccountSequence: string
  feeCharged: number
  maxFee: number
  operationCount?: number
}

interface HorizonTransactionResponseShape {
  hash: unknown
  successful: unknown
  ledger: unknown
  created_at: unknown
  source_account: unknown
  source_account_sequence: unknown
  fee_charged: unknown
  max_fee: unknown
  operation_count?: unknown
}

const TRANSACTION_HASH_PATTERN = /^[a-f0-9]{64}$/i

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()

  if (trimmed.length === 0) {
    throw new Error("Horizon base URL must not be blank")
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(trimmed)
  } catch {
    throw new Error(
      `Invalid Horizon base URL: expected an absolute URL, got ${JSON.stringify(baseUrl)}`,
    )
  }

  return parsedUrl.toString()
}

function normalizeTransactionHash(transactionHash: string): string {
  const normalizedHash = transactionHash.trim().toLowerCase()

  if (!TRANSACTION_HASH_PATTERN.test(normalizedHash)) {
    throw new Error(
      `Invalid transaction hash: expected a 64-character hex string, got ${JSON.stringify(transactionHash)}`,
    )
  }

  return normalizedHash
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid Horizon transaction response: ${fieldName} must be a non-empty string`)
  }

  return value
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Horizon transaction response: ${fieldName} must be a boolean`)
  }

  return value
}

function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid Horizon transaction response: ${fieldName} must be a finite number`)
  }

  return value
}

function readOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return requireNumber(value, fieldName)
}

function normalizeHorizonTransaction(
  transaction: HorizonTransactionResponseShape,
  requestedHash: string,
): HorizonTransaction {
  const hash = requireString(transaction.hash, "hash").toLowerCase()

  if (hash !== requestedHash) {
    throw new Error(
      `Invalid Horizon transaction response: hash mismatch, expected ${requestedHash}, got ${hash}`,
    )
  }

  const normalizedTransaction: HorizonTransaction = {
    hash,
    successful: requireBoolean(transaction.successful, "successful"),
    ledger: requireNumber(transaction.ledger, "ledger"),
    createdAt: requireString(transaction.created_at, "created_at"),
    sourceAccount: requireString(transaction.source_account, "source_account"),
    sourceAccountSequence: requireString(
      transaction.source_account_sequence,
      "source_account_sequence",
    ),
    feeCharged: requireNumber(transaction.fee_charged, "fee_charged"),
    maxFee: requireNumber(transaction.max_fee, "max_fee"),
  }

  const operationCount = readOptionalNumber(
    transaction.operation_count,
    "operation_count",
  )

  if (operationCount !== undefined) {
    normalizedTransaction.operationCount = operationCount
  }

  return normalizedTransaction
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return "<unavailable>"
  }
}

export async function fetchHorizonTransactionByHash(
  horizonBaseUrl: string,
  transactionHash: string,
  init?: RequestInit,
): Promise<HorizonTransaction> {
  const normalizedBaseUrl = normalizeBaseUrl(horizonBaseUrl)
  const normalizedHash = normalizeTransactionHash(transactionHash)
  const requestUrl = new URL(`transactions/${normalizedHash}`, normalizedBaseUrl)

  const response = await fetch(requestUrl, {
    ...init,
    method: "GET",
    body: undefined,
  })

  if (!response.ok) {
    const body = await readResponseBody(response)
    throw new Error(
      `Failed to fetch Horizon transaction ${normalizedHash} from ${requestUrl.toString()}: ${response.status} ${response.statusText}${body.length > 0 ? ` - ${body}` : ""}`,
    )
  }

  let rawTransaction: unknown

  try {
    rawTransaction = await response.json()
  } catch {
    throw new Error(
      `Invalid Horizon transaction response for ${normalizedHash}: expected JSON`,
    )
  }

  if (typeof rawTransaction !== "object" || rawTransaction === null) {
    throw new Error(
      `Invalid Horizon transaction response for ${normalizedHash}: expected an object`,
    )
  }

  const transaction = rawTransaction as HorizonTransactionResponseShape

  return normalizeHorizonTransaction(transaction, normalizedHash)
}
