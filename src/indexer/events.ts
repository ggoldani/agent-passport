import { Buffer } from "node:buffer"
import { xdr, scValToNative } from "@stellar/stellar-sdk"
import type { Server } from "@stellar/stellar-sdk/rpc"

export interface RawEvent {
  id: string
  type: string
  ledger: number
  ledgerClosedAt: string
  transactionIndex: number
  operationIndex: number
  inSuccessfulContractCall: boolean
  txHash: string
  contractId: string
  topic: string[]
  value: string
}

export interface RawGetEventsResponse {
  latestLedger: number
  oldestLedger: number
  latestLedgerCloseTime: string
  oldestLedgerCloseTime: string
  cursor: string
  events: RawEvent[]
}

export type EventType = "agent_registered" | "interaction_registered" | "rating_submitted"

const EVENT_SYMBOL_PREFIXES: Readonly<Record<EventType, string>> = {
  agent_registered: "AgentRegistered",
  interaction_registered: "InteractionRegistered",
  rating_submitted: "RatingSubmitted",
}

export async function fetchLatestLedger(server: Server): Promise<number> {
  const response = await server.getLatestLedger()
  return response.sequence
}

export async function fetchContractEvents(
  server: Server,
  contractId: string,
  startLedger: number,
  endLedger?: number,
  limit = 100,
): Promise<RawGetEventsResponse> {
  const response = await (server as any)._getEvents({
    startLedger,
    endLedger,
    filters: [{ type: "contract", contractIds: [contractId] }],
    pagination: { limit },
  })
  return response
}

export function classifyEvent(event: RawEvent): EventType | null {
  if (!event.topic || event.topic.length === 0) return null
  try {
    const topic0ScVal = xdr.ScVal.fromXDR(event.topic[0], "base64")
    const native = scValToNative(topic0ScVal)
    if (typeof native !== "string") return null
    for (const [eventType, prefix] of Object.entries(EVENT_SYMBOL_PREFIXES)) {
      if (native.includes(prefix)) return eventType as EventType
    }
  } catch {
    return null
  }
  return null
}

export function decodeTopicAddress(topic: string | undefined): string | null {
  if (!topic) return null
  try {
    const scVal = xdr.ScVal.fromXDR(topic, "base64")
    const native = scValToNative(scVal)
    if (typeof native === "string") {
      return native
    }
    return null
  } catch {
    return null
  }
}

export function decodeTopicHash(topic: string | undefined): string | null {
  if (!topic) return null
  try {
    const scVal = xdr.ScVal.fromXDR(topic, "base64")
    const native = scValToNative(scVal)
    if (typeof native === "string") {
      return native
    }
    if (Buffer.isBuffer(native) || native instanceof Uint8Array) {
      return Buffer.from(native).toString("hex")
    }
    return null
  } catch {
    return null
  }
}

export function decodeEventValueFields(base64Value: string): any[] {
  const scVal = xdr.ScVal.fromXDR(base64Value, "base64")
  return scValToNative(scVal) as any[]
}
