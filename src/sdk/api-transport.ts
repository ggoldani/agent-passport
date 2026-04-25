import type {
  AgentPassportMethodArgs,
  AgentPassportMethodResult,
  AgentPassportReadMethodName,
  AgentPassportTransport,
  AgentPassportWriteMethodName,
} from "./agent-passport.js"
import type { AgentProfile, InteractionRecord, RatingRecord } from "./types.js"

export interface TrustApiTransportConfig {
  baseUrl: string
  timeoutMs?: number
}

export class TrustApiTransport implements AgentPassportTransport {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(config: TrustApiTransportConfig) {
    const url = config.baseUrl.replace(/\/$/, "")
    if (!url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1") && !url.startsWith("https://")) {
      throw new Error(`TrustApiTransport requires HTTPS for non-local connections: ${url}`)
    }
    this.baseUrl = url
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async read<M extends AgentPassportReadMethodName>(
    _contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    switch (method) {
      case "get_agent": {
        const { data, status } = await this.fetchJson<Record<string, unknown>>(`/agents/${args[0]}`)
        if (status === 404 || data === null) throw new Error(`Agent not found: ${args[0]}`)
        return this.toAgentProfile(data) as AgentPassportMethodResult[M]
      }
      case "list_agents": {
        const [from, limit] = args as [number, number]
        const { data } = await this.fetchJson<{ data: unknown[] }>(`/agents?from=${from}&limit=${limit}`)
        const raw = data && typeof data === "object" && "data" in data ? (data as { data: unknown[] }).data : []
        const list = Array.isArray(raw) ? raw : []
        return list.map((a) => this.toAgentProfile(a as Record<string, unknown>)) as AgentPassportMethodResult[M]
      }
      case "get_rating": {
        const txHash = args[0] as string
        const { data, status } = await this.fetchJson<Record<string, unknown>>(`/ratings/${txHash}`)
        if (status === 404 || data === null) return null as AgentPassportMethodResult[M]
        return this.toRatingRecord(data) as AgentPassportMethodResult[M]
      }
      case "list_agent_interactions": {
        const [providerAddress, fromSeq, limit] = args as [string, number, number]
        const { data } = await this.fetchJson<{ data: unknown[] }>(`/agents/${providerAddress}/interactions?from=${fromSeq}&limit=${limit}`)
        const raw = data && typeof data === "object" && "data" in data ? (data as { data: unknown[] }).data : []
        const list = Array.isArray(raw) ? raw : []
        return list.map((i) => this.toInteractionRecord(i as Record<string, unknown>)) as AgentPassportMethodResult[M]
      }
      case "get_config":
      case "get_relayers": {
        throw new Error("getConfig()/getRelayers() is not available via TrustApiTransport. Use SorobanRpcTransport for admin operations.")
      }
      default: {
        const _exhaustive: never = method
        throw new Error(`Unknown read method: ${_exhaustive}`)
      }
    }
  }

  async write<M extends AgentPassportWriteMethodName>(
    _contractId: string,
    method: M,
    _args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    throw new Error(`Write method "${method}" is not available via TrustApiTransport. Use SorobanRpcTransport for write operations.`)
  }

  private async fetchJson<T>(path: string): Promise<{ data: T | null; status: number }> {
    // NOTE: Callers MUST check status before using data — data is null when !res.ok
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal })
      if (!res.ok) return { data: null, status: res.status }
      return { data: await res.json(), status: res.status }
    } finally {
      clearTimeout(timeout)
    }
  }

  private safeBigInt(value: unknown, field: string): bigint {
    if (value === null || value === undefined) return 0n
    if (typeof value === "bigint") return value
    if (typeof value === "number") return BigInt(value)
    if (typeof value === "string") {
      if (/^-?\d+$/.test(value)) return BigInt(value)
      throw new TypeError(`Invalid BigInt value for field "${field}": "${value}"`)
    }
    throw new TypeError(`Cannot convert field "${field}" to BigInt: got ${typeof value}`)
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value === "string") return value
    throw new TypeError(`Missing or invalid required string field "${field}"`)
  }

  private toAgentProfile(data: Record<string, unknown>): AgentProfile {
    return {
      name: this.requireString(data.name, "name"),
      description: this.requireString(data.description, "description"),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      owner_address: this.requireString(data.owner_address, "owner_address"),
      service_url: typeof data.service_url === "string" ? data.service_url : null,
      mcp_server_url: typeof data.mcp_server_url === "string" ? data.mcp_server_url : null,
      payment_endpoint: typeof data.payment_endpoint === "string" ? data.payment_endpoint : null,
      created_at: this.safeBigInt(data.created_at, "created_at"),
      score: typeof data.score === "number" ? data.score : 0,
      verified_interactions_count: this.safeBigInt(data.verified_interactions_count, "verified_interactions_count"),
      total_economic_volume: this.safeBigInt(data.total_economic_volume, "total_economic_volume"),
      unique_counterparties_count: this.safeBigInt(data.unique_counterparties_count, "unique_counterparties_count"),
      last_interaction_timestamp: this.safeBigInt(data.last_interaction_timestamp, "last_interaction_timestamp"),
    }
  }

  private toInteractionRecord(data: Record<string, unknown>): InteractionRecord {
    return {
      provider_address: this.requireString(data.provider_address, "provider_address"),
      consumer_address: this.requireString(data.consumer_address, "consumer_address"),
      amount: this.safeBigInt(data.amount, "amount"),
      tx_hash: this.requireString(data.tx_hash, "tx_hash"),
      timestamp: this.safeBigInt(data.timestamp, "timestamp"),
      service_label: typeof data.service_label === "string" ? data.service_label : null,
    }
  }

  private toRatingRecord(data: Record<string, unknown>): RatingRecord {
    return {
      provider_address: this.requireString(data.provider_address, "provider_address"),
      consumer_address: this.requireString(data.consumer_address, "consumer_address"),
      interaction_tx_hash: this.requireString(data.interaction_tx_hash, "interaction_tx_hash"),
      score: typeof data.score === "number" ? data.score : 0,
      timestamp: this.safeBigInt(data.timestamp, "timestamp"),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fetchApi<T>(path: string): Promise<{ data: T; status: number }> {
    return this.fetchJson<T>(path) as Promise<{ data: T; status: number }>
  }
}
