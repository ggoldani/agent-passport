import { StrKey } from "@stellar/stellar-sdk"

import type {
  Address,
  AgentProfile,
  AgentProfileInput,
  Config,
  InteractionRecord,
  RatingInput,
  RatingRecord,
  RichRatingInput,
  RichRatingRecord,
  AnalyticsOptions,
  AnalyticsResponse,
  BadgeStatsResponse,
  TrustCheckOptions,
  TrustCheckResult,
} from "./types.js"

export const AGENT_PASSPORT_READ_METHODS = [
  "get_config",
  "get_agent",
  "get_rating",
  "list_agents",
  "list_agent_interactions",
  "get_relayers",
] as const

export const AGENT_PASSPORT_WRITE_METHODS = [
  "init",
  "add_relayer",
  "remove_relayer",
  "transfer_admin",
  "accept_admin",
  "cancel_admin_transfer",
  "register_agent",
  "update_profile",
  "deregister_agent",
  "register_interaction",
  "submit_rating",
] as const

export const AGENT_PASSPORT_METHODS = [
  ...AGENT_PASSPORT_READ_METHODS,
  ...AGENT_PASSPORT_WRITE_METHODS,
] as const

export type AgentPassportReadMethodName =
  (typeof AGENT_PASSPORT_READ_METHODS)[number]
export type AgentPassportWriteMethodName =
  (typeof AGENT_PASSPORT_WRITE_METHODS)[number]
export type AgentPassportMethodName = (typeof AGENT_PASSPORT_METHODS)[number]

export interface AgentPassportMethodArgs {
  init: [admin: Address, authorized_relayer: Address]
  get_config: []
  get_relayers: []
  add_relayer: [admin: Address, relayer: Address]
  remove_relayer: [admin: Address, relayer: Address]
  transfer_admin: [admin: Address, new_admin: Address]
  accept_admin: [new_admin: Address]
  cancel_admin_transfer: [admin: Address]
  register_agent: [owner_address: Address, input: AgentProfileInput]
  get_agent: [owner_address: Address]
  get_rating: [interaction_tx_hash: string]
  list_agents: [from: number, limit: number]
  register_interaction: [relayer: Address, interaction: InteractionRecord]
  list_agent_interactions: [provider_address: Address, from_seq: number, limit: number]
  submit_rating: [rating: RatingInput]
  update_profile: [owner_address: Address, input: AgentProfileInput]
  deregister_agent: [owner_address: Address]
}

export interface AgentPassportMethodResult {
  init: void
  get_config: Config
  get_relayers: string[]
  add_relayer: void
  remove_relayer: void
  transfer_admin: void
  accept_admin: void
  cancel_admin_transfer: void
  register_agent: void
  get_agent: AgentProfile
  get_rating: RatingRecord | null
  list_agents: AgentProfile[]
  register_interaction: void
  list_agent_interactions: InteractionRecord[]
  submit_rating: void
  update_profile: void
  deregister_agent: void
}

export interface AgentPassportTransport {
  read<M extends AgentPassportReadMethodName>(
    contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]>

  write<M extends AgentPassportWriteMethodName>(
    contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]>

  fetchApi<T>(path: string): Promise<{ data: T; status: number }>
}

export interface AgentPassportClientOptions {
  contractId: string
  transport: AgentPassportTransport
}

export class AgentPassportClient {
  readonly contractId: string
  readonly transport: AgentPassportTransport

  constructor(options: AgentPassportClientOptions) {
    if (!StrKey.isValidContract(options.contractId)) {
      throw new Error(`Invalid contract ID: ${options.contractId}. Must be a valid Stellar contract address (C...).`)
    }
    this.contractId = options.contractId
    this.transport = options.transport
  }

  protected readContract<M extends AgentPassportReadMethodName>(
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    return this.transport.read(this.contractId, method, args)
  }

  protected writeContract<M extends AgentPassportWriteMethodName>(
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    return this.transport.write(this.contractId, method, args)
  }

  registerAgent(
    ownerAddress: Address,
    input: AgentProfileInput,
  ): Promise<void> {
    return this.writeContract("register_agent", [ownerAddress, input])
  }

  getAgent(ownerAddress: Address): Promise<AgentProfile> {
    return this.readContract("get_agent", [ownerAddress])
  }

  getRating(interactionTxHash: string): Promise<RatingRecord | null> {
    return this.readContract("get_rating", [interactionTxHash])
  }

  listAgents(from = 0, limit = 100): Promise<AgentProfile[]> {
    return this.readContract("list_agents", [from, limit])
  }

  registerInteraction(
    relayer: Address,
    interaction: InteractionRecord,
  ): Promise<void> {
    return this.writeContract("register_interaction", [
      relayer,
      interaction,
    ])
  }

  listAgentInteractions(providerAddress: Address, fromSeq = 0, limit = 100): Promise<InteractionRecord[]> {
    return this.readContract("list_agent_interactions", [providerAddress, fromSeq, limit])
  }

  submitRating(rating: RatingInput): Promise<void> {
    return this.writeContract("submit_rating", [rating])
  }

  getConfig(): Promise<Config> {
    return this.readContract("get_config", [])
  }

  getRelayers(): Promise<string[]> {
    return this.readContract("get_relayers", [])
  }

  addRelayer(admin: Address, relayer: Address): Promise<void> {
    return this.writeContract("add_relayer", [admin, relayer])
  }

  removeRelayer(admin: Address, relayer: Address): Promise<void> {
    return this.writeContract("remove_relayer", [admin, relayer])
  }

  transferAdmin(admin: Address, newAdmin: Address): Promise<void> {
    return this.writeContract("transfer_admin", [admin, newAdmin])
  }

  acceptAdmin(newAdmin: Address): Promise<void> {
    return this.writeContract("accept_admin", [newAdmin])
  }

  cancelAdminTransfer(admin: Address): Promise<void> {
    return this.writeContract("cancel_admin_transfer", [admin])
  }

  updateProfile(ownerAddress: Address, input: AgentProfileInput): Promise<void> {
    return this.writeContract("update_profile", [ownerAddress, input])
  }

  deregisterAgent(ownerAddress: Address): Promise<void> {
    return this.writeContract("deregister_agent", [ownerAddress])
  }

  submitRichRating(input: RichRatingInput): Promise<RichRatingRecord> {
    const onChainRating: RatingInput = {
      provider_address: input.provider_address,
      consumer_address: input.consumer_address,
      interaction_tx_hash: input.interaction_tx_hash,
      score: input.score,
    }

    return this.writeContract("submit_rating", [onChainRating]).then(() => ({
      provider_address: input.provider_address,
      consumer_address: input.consumer_address,
      interaction_tx_hash: input.interaction_tx_hash,
      score: input.score,
      quality: input.quality ?? null,
      speed: input.speed ?? null,
      reliability: input.reliability ?? null,
      communication: input.communication ?? null,
      comment: input.comment ?? null,
      submitted_at: new Date().toISOString(),
    }))
  }

  async trustCheck(
    address: Address,
    options: TrustCheckOptions = {},
  ): Promise<TrustCheckResult> {
    const params = new URLSearchParams()
    if (options.threshold !== undefined) params.set("threshold", String(options.threshold))
    if (options.minInteractions !== undefined) params.set("minInteractions", String(options.minInteractions))
    const qs = params.toString()
    const path = `/trust-check/${address}${qs ? `?${qs}` : ""}`
    const { data, status } = await this.transport.fetchApi<TrustCheckResult>(path)
    if (status === 404) throw new Error(`Agent not found: ${address}`)
    return data
  }

  async getAnalytics(
    address: string,
    options: AnalyticsOptions = {},
  ): Promise<AnalyticsResponse> {
    const params = new URLSearchParams()
    if (options.period) params.set("period", options.period)
    const qs = params.toString()
    const path = `/agents/${address}/stats${qs ? `?${qs}` : ""}`
    const { data, status } = await this.transport.fetchApi<AnalyticsResponse>(path)
    if (status === 404) throw new Error(`Agent not found: ${address}`)
    return data
  }

  async getBadgeStats(address: string): Promise<BadgeStatsResponse> {
    const path = `/badge-stats/${address}`
    const { data, status } = await this.transport.fetchApi<BadgeStatsResponse>(path)
    if (status === 404) throw new Error(`Agent not found: ${address}`)
    return data
  }
}
