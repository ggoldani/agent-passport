import type { WorkerInteractionPayload } from "../../../scripts/worker/lib/payload"

export interface PaidRequestSettlementContext {
  consumerAddress: string
  txHash: string
}

export interface ProviderWorkerHandshakeInput {
  providerAddress: string
  paidRequest: PaidRequestSettlementContext
  amount: string
  asset: string
  occurredAt: string
  serviceLabel?: string
}

export function buildWorkerInteractionPayload(
  input: ProviderWorkerHandshakeInput,
): WorkerInteractionPayload {
  return input.serviceLabel === undefined
    ? {
        providerAddress: input.providerAddress,
        consumerAddress: input.paidRequest.consumerAddress,
        txHash: input.paidRequest.txHash,
        amount: input.amount,
        asset: input.asset,
        occurredAt: input.occurredAt,
      }
    : {
        providerAddress: input.providerAddress,
        consumerAddress: input.paidRequest.consumerAddress,
        txHash: input.paidRequest.txHash,
        amount: input.amount,
        asset: input.asset,
        occurredAt: input.occurredAt,
        serviceLabel: input.serviceLabel,
      }
}
