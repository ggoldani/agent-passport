import type {
  AgentPassportMethodArgs,
  AgentPassportMethodResult,
  AgentPassportReadMethodName,
  AgentPassportTransport,
  AgentPassportWriteMethodName,
} from "./agent-passport.js"

export interface TrustApiTransportConfig {
  baseUrl: string
  timeoutMs?: number
}

export class TrustApiTransport implements AgentPassportTransport {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(config: TrustApiTransportConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "")
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async read<M extends AgentPassportReadMethodName>(
    _contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    switch (method) {
      case "get_agent": {
        const data = await this.fetchJson(`/agents/${args[0]}`)
        return this.toAgentProfile(data) as AgentPassportMethodResult[M]
      }
      case "list_agents": {
        const resp = await this.fetchJson<{ data: any[] }>(`/agents?limit=100`)
        const list = Array.isArray(resp?.data) ? resp.data : []
        return list.map((a: any) => this.toAgentProfile(a)) as AgentPassportMethodResult[M]
      }
      case "get_rating": {
        const txHash = args[0] as string
        try {
          const data = await this.fetchJson<any>(`/ratings/${txHash}`)
          return this.toRatingRecord(data) as AgentPassportMethodResult[M]
        } catch (e) {
          if (e instanceof Error && e.message.includes("404")) return null as AgentPassportMethodResult[M]
          throw e
        }
      }
      case "list_agent_interactions": {
        const resp = await this.fetchJson<{ data: any[] }>(`/agents/${args[0]}/interactions?limit=100`)
        const list = Array.isArray(resp?.data) ? resp.data : []
        return list.map((i: any) => this.toInteractionRecord(i)) as AgentPassportMethodResult[M]
      }
      case "get_config": {
        throw new Error("getConfig() is not available via TrustApiTransport. Use SorobanRpcTransport for admin operations.")
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

  private async fetchJson<T>(path: string): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`)
      return res.json()
    } finally {
      clearTimeout(timeout)
    }
  }

  private toAgentProfile(data: any): any {
    return {
      name: data.name,
      description: data.description,
      tags: data.tags,
      owner_address: data.owner_address,
      service_url: data.service_url,
      mcp_server_url: data.mcp_server_url,
      payment_endpoint: data.payment_endpoint,
      created_at: BigInt(data.created_at),
      score: data.score,
      verified_interactions_count: BigInt(data.verified_interactions_count),
      total_economic_volume: BigInt(data.total_economic_volume),
      unique_counterparties_count: BigInt(data.unique_counterparties_count),
      last_interaction_timestamp: data.last_interaction_timestamp ? BigInt(data.last_interaction_timestamp) : 0n,
    }
  }

  private toInteractionRecord(data: any): any {
    return {
      provider_address: data.provider_address,
      consumer_address: data.consumer_address,
      amount: BigInt(data.amount),
      tx_hash: data.tx_hash,
      timestamp: BigInt(data.timestamp),
      service_label: data.service_label,
    }
  }

  private toRatingRecord(data: any): any {
    return {
      provider_address: data.provider_address,
      consumer_address: data.consumer_address,
      interaction_tx_hash: data.interaction_tx_hash,
      score: data.score,
      timestamp: BigInt(data.timestamp),
    }
  }
}
