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
} from "./types.js"

export const AGENT_PASSPORT_READ_METHODS = [
  "get_config",
  "get_agent",
  "get_rating",
  "list_agents",
  "list_agent_interactions",
] as const

export const AGENT_PASSPORT_WRITE_METHODS = [
  "init",
  "update_relayer",
  "register_agent",
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
  update_relayer: [admin: Address, authorized_relayer: Address]
  register_agent: [owner_address: Address, input: AgentProfileInput]
  get_agent: [owner_address: Address]
  get_rating: [interaction_tx_hash: string]
  list_agents: []
  register_interaction: [relayer: Address, interaction: InteractionRecord]
  list_agent_interactions: [provider_address: Address]
  submit_rating: [rating: RatingInput]
}

export interface AgentPassportMethodResult {
  init: void
  get_config: Config
  update_relayer: void
  register_agent: void
  get_agent: AgentProfile
  get_rating: RatingRecord | null
  list_agents: AgentProfile[]
  register_interaction: void
  list_agent_interactions: InteractionRecord[]
  submit_rating: void
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
}

export interface AgentPassportClientOptions {
  contractId: string
  transport: AgentPassportTransport
}

export class AgentPassportClient {
  readonly contractId: string
  readonly transport: AgentPassportTransport

  constructor(options: AgentPassportClientOptions) {
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

  listAgents(): Promise<AgentProfile[]> {
    return this.readContract("list_agents", [])
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

  listAgentInteractions(providerAddress: Address): Promise<InteractionRecord[]> {
    return this.readContract("list_agent_interactions", [providerAddress])
  }

  submitRating(rating: RatingInput): Promise<void> {
    return this.writeContract("submit_rating", [rating])
  }
}
