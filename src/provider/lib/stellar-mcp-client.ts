import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

export interface StellarMcpClientConfigEnv {
  STELLAR_MCP_URL?: string
}

export interface StellarMcpClientConfig {
  baseUrl: string
  mcpEndpointUrl: string
  healthEndpointUrl: string
}

export interface StellarMcpAccountFlags {
  auth_required: boolean
  auth_revocable: boolean
  auth_immutable: boolean
  auth_clawback_enabled: boolean
}

export interface StellarMcpAccountBalance {
  balance: string
  buying_liabilities: string
  selling_liabilities: string
  asset_type: string
  asset_code?: string
  asset_issuer?: string
}

export interface StellarMcpAccountSigner {
  weight: number
  key: string
  type: string
}

export interface StellarMcpAccount {
  accountId: string
  sequence: string
  balances: StellarMcpAccountBalance[]
  signers: StellarMcpAccountSigner[]
  flags: StellarMcpAccountFlags
  subentryCount: number
  minimumBalance: string
}

export interface StellarMcpAccountHistoryRecord {
  id: string
  hash: string
  ledger: number
  createdAt: string
  sourceAccount: string
  feeCharged: string
  successful: boolean
  operationCount: number
  memo: string | null
  memoType: string | null
  operations: StellarMcpAccountHistoryOperation[]
}

export interface StellarMcpAccountHistoryOperation {
  id: string
  type: string
  typeI: number
  createdAt: string
  sourceAccount: string
  transactionSuccessful: boolean
}

export interface StellarMcpAccountHistory {
  records: StellarMcpAccountHistoryRecord[]
  nextCursor: string | null
}

function readRequiredEnvVar(
  env: StellarMcpClientConfigEnv,
  key: keyof StellarMcpClientConfigEnv,
): string {
  const value = env[key]

  if (value === undefined) {
    throw new Error(`Missing required env var: ${String(key)}`)
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Required env var must not be blank: ${String(key)}`)
  }

  return normalized
}

function normalizeAbsoluteUrl(urlValue: string, envKey: string): URL {
  try {
    return new URL(urlValue)
  } catch {
    throw new Error(
      `Invalid ${envKey}: expected an absolute URL, got ${JSON.stringify(urlValue)}`,
    )
  }
}

function normalizeBasePath(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, "")

  if (normalizedPath === "" || normalizedPath === "/") {
    return ""
  }

  if (normalizedPath.endsWith("/mcp")) {
    const basePath = normalizedPath.slice(0, -"/mcp".length)
    return basePath === "" ? "" : basePath
  }

  return normalizedPath
}

function buildEndpointUrl(parsedUrl: URL, endpointPath: "/mcp" | "/health"): string {
  const basePath = normalizeBasePath(parsedUrl.pathname)
  const endpointUrl = new URL(parsedUrl.toString())

  endpointUrl.pathname = `${basePath}${endpointPath}` || endpointPath
  endpointUrl.search = ""
  endpointUrl.hash = ""

  return endpointUrl.toString()
}

export function loadStellarMcpClientConfig(
  env: StellarMcpClientConfigEnv,
): StellarMcpClientConfig {
  const parsedUrl = normalizeAbsoluteUrl(
    readRequiredEnvVar(env, "STELLAR_MCP_URL"),
    "STELLAR_MCP_URL",
  )
  const baseUrl = new URL(parsedUrl.toString())

  baseUrl.pathname = normalizeBasePath(baseUrl.pathname) || "/"
  baseUrl.search = ""
  baseUrl.hash = ""

  return {
    baseUrl: baseUrl.toString(),
    mcpEndpointUrl: buildEndpointUrl(parsedUrl, "/mcp"),
    healthEndpointUrl: buildEndpointUrl(parsedUrl, "/health"),
  }
}

export class StellarMcpClient {
  readonly baseUrl: string
  readonly mcpEndpointUrl: string
  readonly healthEndpointUrl: string
  #clientPromise: Promise<Client> | null

  constructor(config: StellarMcpClientConfig) {
    this.baseUrl = config.baseUrl
    this.mcpEndpointUrl = config.mcpEndpointUrl
    this.healthEndpointUrl = config.healthEndpointUrl
    this.#clientPromise = null
  }

  static fromEnv(env: StellarMcpClientConfigEnv): StellarMcpClient {
    return new StellarMcpClient(loadStellarMcpClientConfig(env))
  }

  async getAccount(publicKey: string): Promise<StellarMcpAccount> {
    const client = await this.#getClient()
    const result = await client.callTool({
      name: "stellar_get_account",
      arguments: { publicKey },
    })

    return parseStellarMcpAccountResult(
      parseToolTextJson(result.content, "stellar_get_account"),
    )
  }

  async getAccountHistory(
    publicKey: string,
    options: {
      limit?: number
      cursor?: string
      includeOperations?: boolean
    } = {},
  ): Promise<StellarMcpAccountHistory> {
    const client = await this.#getClient()
    const result = await client.callTool({
      name: "stellar_get_account_history",
      arguments: {
        publicKey,
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
        ...(options.includeOperations === undefined
          ? {}
          : { includeOperations: options.includeOperations }),
      },
    })

    return parseStellarMcpAccountHistoryResult(
      parseToolTextJson(result.content, "stellar_get_account_history"),
    )
  }

  async close(): Promise<void> {
    if (this.#clientPromise === null) {
      return
    }

    const client = await this.#clientPromise
    this.#clientPromise = null
    await client.close()
  }

  async #getClient(): Promise<Client> {
    if (this.#clientPromise !== null) {
      return this.#clientPromise
    }

    this.#clientPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.mcpEndpointUrl),
      )
      const client = new Client({
        name: "agent-passport-provider",
        version: "0.1.0",
      })

      try {
        await client.connect(transport)
        return client
      } catch (error) {
        this.#clientPromise = null
        throw error
      }
    })()

    return this.#clientPromise
  }
}

function parseToolTextJson(content: unknown, toolName: string): unknown {
  if (!Array.isArray(content)) {
    throw new Error(`${toolName} returned unexpected content shape`)
  }

  const textItem = content.find((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
    )
  })

  if (textItem === undefined) {
    throw new Error(`${toolName} did not return a text payload`)
  }

  try {
    return JSON.parse(textItem.text)
  } catch {
    throw new Error(`${toolName} returned invalid JSON text`)
  }
}

function parseBooleanRecord(
  value: unknown,
  fieldName: string,
): StellarMcpAccountFlags {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid stellar_get_account response: ${fieldName} must be an object`)
  }

  const flags = value as Record<string, unknown>

  if (
    typeof flags.auth_required !== "boolean" ||
    typeof flags.auth_revocable !== "boolean" ||
    typeof flags.auth_immutable !== "boolean" ||
    typeof flags.auth_clawback_enabled !== "boolean"
  ) {
    throw new Error(`Invalid stellar_get_account response: ${fieldName} has unexpected shape`)
  }

  return {
    auth_required: flags.auth_required,
    auth_revocable: flags.auth_revocable,
    auth_immutable: flags.auth_immutable,
    auth_clawback_enabled: flags.auth_clawback_enabled,
  }
}

function parseBalances(value: unknown): StellarMcpAccountBalance[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid stellar_get_account response: balances must be an array")
  }

  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Invalid stellar_get_account response: balance entry must be an object")
    }

    const balance = entry as Record<string, unknown>

    if (
      typeof balance.balance !== "string" ||
      typeof balance.buying_liabilities !== "string" ||
      typeof balance.selling_liabilities !== "string" ||
      typeof balance.asset_type !== "string"
    ) {
      throw new Error("Invalid stellar_get_account response: balance entry has unexpected shape")
    }

    return {
      balance: balance.balance,
      buying_liabilities: balance.buying_liabilities,
      selling_liabilities: balance.selling_liabilities,
      asset_type: balance.asset_type,
      asset_code:
        typeof balance.asset_code === "string" ? balance.asset_code : undefined,
      asset_issuer:
        typeof balance.asset_issuer === "string" ? balance.asset_issuer : undefined,
    }
  })
}

function parseSigners(value: unknown): StellarMcpAccountSigner[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid stellar_get_account response: signers must be an array")
  }

  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Invalid stellar_get_account response: signer entry must be an object")
    }

    const signer = entry as Record<string, unknown>

    if (
      typeof signer.weight !== "number" ||
      typeof signer.key !== "string" ||
      typeof signer.type !== "string"
    ) {
      throw new Error("Invalid stellar_get_account response: signer entry has unexpected shape")
    }

    return {
      weight: signer.weight,
      key: signer.key,
      type: signer.type,
    }
  })
}

function parseStellarMcpAccountResult(value: unknown): StellarMcpAccount {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid stellar_get_account response: expected an object")
  }

  const account = value as Record<string, unknown>

  if (
    typeof account.accountId !== "string" ||
    typeof account.sequence !== "string" ||
    typeof account.subentryCount !== "number" ||
    typeof account.minimumBalance !== "string"
  ) {
    throw new Error("Invalid stellar_get_account response: missing required fields")
  }

  return {
    accountId: account.accountId,
    sequence: account.sequence,
    balances: parseBalances(account.balances),
    signers: parseSigners(account.signers),
    flags: parseBooleanRecord(account.flags, "flags"),
    subentryCount: account.subentryCount,
    minimumBalance: account.minimumBalance,
  }
}

function parseNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid stellar_get_account_history response: ${fieldName} has unexpected shape`)
  }

  return value
}

function parseAccountHistoryRecords(
  value: unknown,
): StellarMcpAccountHistoryRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid stellar_get_account_history response: records must be an array")
  }

  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Invalid stellar_get_account_history response: record must be an object")
    }

    const record = entry as Record<string, unknown>

    if (
      typeof record.id !== "string" ||
      typeof record.hash !== "string" ||
      typeof record.ledger !== "number" ||
      typeof record.createdAt !== "string" ||
      typeof record.sourceAccount !== "string" ||
      typeof record.feeCharged !== "string" ||
      typeof record.successful !== "boolean" ||
      typeof record.operationCount !== "number"
    ) {
      throw new Error("Invalid stellar_get_account_history response: record has unexpected shape")
    }

    return {
      id: record.id,
      hash: record.hash,
      ledger: record.ledger,
      createdAt: record.createdAt,
      sourceAccount: record.sourceAccount,
      feeCharged: record.feeCharged,
      successful: record.successful,
      operationCount: record.operationCount,
      memo: parseNullableString(record.memo, "memo"),
      memoType: parseNullableString(record.memoType, "memoType"),
      operations: parseAccountHistoryOperations(record.operations),
    }
  })
}

function parseAccountHistoryOperations(
  value: unknown,
): StellarMcpAccountHistoryOperation[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new Error("Invalid stellar_get_account_history response: operations must be an array")
  }

  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Invalid stellar_get_account_history response: operation must be an object")
    }

    const operation = entry as Record<string, unknown>

    if (
      typeof operation.id !== "string" ||
      typeof operation.type !== "string" ||
      typeof operation.typeI !== "number" ||
      typeof operation.createdAt !== "string" ||
      typeof operation.sourceAccount !== "string" ||
      typeof operation.transactionSuccessful !== "boolean"
    ) {
      throw new Error("Invalid stellar_get_account_history response: operation has unexpected shape")
    }

    return {
      id: operation.id,
      type: operation.type,
      typeI: operation.typeI,
      createdAt: operation.createdAt,
      sourceAccount: operation.sourceAccount,
      transactionSuccessful: operation.transactionSuccessful,
    }
  })
}

function parseStellarMcpAccountHistoryResult(
  value: unknown,
): StellarMcpAccountHistory {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid stellar_get_account_history response: expected an object")
  }

  const history = value as Record<string, unknown>
  const nextCursor = history.nextCursor

  if (!(typeof nextCursor === "string" || nextCursor === null || nextCursor === undefined)) {
    throw new Error("Invalid stellar_get_account_history response: nextCursor has unexpected shape")
  }

  return {
    records: parseAccountHistoryRecords(history.records),
    nextCursor: (nextCursor ?? null) as string | null,
  }
}
