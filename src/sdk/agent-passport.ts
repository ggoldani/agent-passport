import type {
  Address,
  AgentProfile,
  AgentProfileInput,
  Config,
  InteractionRecord,
  RatingInput,
} from "./types"

export const AGENT_PASSPORT_READ_METHODS = [
  "get_config",
  "get_agent",
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
}
