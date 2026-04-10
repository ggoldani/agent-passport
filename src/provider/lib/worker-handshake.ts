import {
  buildWorkerBootstrapResult,
  type WorkerBootstrapResult,
} from "../../../scripts/worker/index.js"
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

export interface ProviderWorkerRegistrationInput {
  providerAddress: string
  consumerAddress: string
  txHash: string
  amount: string
  asset: string
  occurredAt: string
  serviceLabel?: string
}

export function createProviderWorkerHandshakeInput(
  input: ProviderWorkerRegistrationInput,
): ProviderWorkerHandshakeInput {
  return input.serviceLabel === undefined
    ? {
        providerAddress: input.providerAddress,
        paidRequest: {
          consumerAddress: input.consumerAddress,
          txHash: input.txHash,
        },
        amount: input.amount,
        asset: input.asset,
        occurredAt: input.occurredAt,
      }
    : {
        providerAddress: input.providerAddress,
        paidRequest: {
          consumerAddress: input.consumerAddress,
          txHash: input.txHash,
        },
        amount: input.amount,
        asset: input.asset,
        occurredAt: input.occurredAt,
        serviceLabel: input.serviceLabel,
      }
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

export async function runProviderWorkerHandshake(
  input: ProviderWorkerHandshakeInput,
): Promise<WorkerBootstrapResult> {
  return await buildWorkerBootstrapResult(input)
}
