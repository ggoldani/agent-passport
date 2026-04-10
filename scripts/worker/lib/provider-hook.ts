import type { WorkerInteractionPayload } from "./payload"
import {
  buildWorkerInteractionPayload,
  type ProviderWorkerHandshakeInput,
} from "../../../src/provider/lib/worker-handshake"

export type { PaidRequestSettlementContext } from "../../../src/provider/lib/worker-handshake"
export type { ProviderWorkerHandshakeInput } from "../../../src/provider/lib/worker-handshake"

export function createProviderHookPayload(
  input: ProviderWorkerHandshakeInput,
): WorkerInteractionPayload {
  return buildWorkerInteractionPayload(input)
}
