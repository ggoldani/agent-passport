export interface WorkerInteractionPayload {
  providerAddress: string
  consumerAddress: string
  txHash: string
  amount: string
  asset: string
  occurredAt: string
  serviceLabel?: string
}

function toCanonicalWorkerInteractionPayload(
  payload: WorkerInteractionPayload,
): WorkerInteractionPayload {
  // Keep serialization deterministic by rebuilding the object in a fixed order.
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

export function encodeWorkerInteractionPayload(
  payload: WorkerInteractionPayload,
): string {
  return JSON.stringify(toCanonicalWorkerInteractionPayload(payload))
}

export function formatWorkerInteractionPayloadLog(
  payload: WorkerInteractionPayload,
): string {
  return `worker_interaction_payload=${encodeWorkerInteractionPayload(payload)}`
}
