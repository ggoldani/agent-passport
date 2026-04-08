import {
  BASE_FEE,
  Keypair,
  nativeToScVal,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk"
import { Server, type Api } from "@stellar/stellar-sdk/rpc"

import type { WorkerInteractionPayload } from "./payload"
import type { RelayerConfig } from "./relayer"

const TRANSACTION_HASH_PATTERN = /^[a-f0-9]{64}$/i
const DEFAULT_TIMEOUT_SECONDS = 30

export interface SubmitInteractionOptions {
  mode?: "submit" | "dry-run"
  timeoutInSeconds?: number
}

export interface DryRunInteractionSubmission {
  mode: "dry-run"
  relayerAddress: string
  transactionXdr: string
}

export interface SubmittedInteractionResult {
  mode: "submit"
  relayerAddress: string
  transactionXdr: string
  submission: Api.SendTransactionResponse
  response: Api.GetTransactionResponse
}

export type SubmitInteractionResult =
  | DryRunInteractionSubmission
  | SubmittedInteractionResult

function normalizeSubmissionMode(
  mode: SubmitInteractionOptions["mode"],
): "submit" | "dry-run" {
  if (mode === undefined) {
    return "submit"
  }

  if (mode !== "submit" && mode !== "dry-run") {
    throw new Error(
      `Invalid mode: expected "submit" or "dry-run", got ${JSON.stringify(mode)}`,
    )
  }

  return mode
}

function normalizeTimeoutInSeconds(timeoutInSeconds: number | undefined): number {
  if (timeoutInSeconds === undefined) {
    return DEFAULT_TIMEOUT_SECONDS
  }

  if (!Number.isInteger(timeoutInSeconds) || timeoutInSeconds <= 0) {
    throw new Error(
      `Invalid timeoutInSeconds: expected a positive integer, got ${JSON.stringify(timeoutInSeconds)}`,
    )
  }

  return timeoutInSeconds
}

function normalizeTransactionHashToBytes(transactionHash: string): Uint8Array {
  const normalizedHash = transactionHash.trim().toLowerCase()

  if (!TRANSACTION_HASH_PATTERN.test(normalizedHash)) {
    throw new Error(
      `Invalid txHash: expected a 64-character hex string, got ${JSON.stringify(transactionHash)}`,
    )
  }

  const bytes = new Uint8Array(normalizedHash.length / 2)
  for (let index = 0; index < normalizedHash.length; index += 2) {
    bytes[index / 2] = Number.parseInt(
      normalizedHash.slice(index, index + 2),
      16,
    )
  }

  return bytes
}

function normalizeAmount(amount: string): bigint {
  const normalizedAmount = amount.trim()

  if (!/^-?[0-9]+$/.test(normalizedAmount)) {
    throw new Error(
      `Invalid amount: expected an integer string, got ${JSON.stringify(amount)}`,
    )
  }

  const parsedAmount = BigInt(normalizedAmount)
  if (parsedAmount <= 0n) {
    throw new Error(
      `Invalid amount: expected a positive integer string, got ${JSON.stringify(amount)}`,
    )
  }

  return parsedAmount
}

function normalizeOccurredAtToUnixSeconds(occurredAt: string): bigint {
  const normalizedOccurredAt = occurredAt.trim()
  const isoUtcPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

  if (/^[0-9]+$/.test(normalizedOccurredAt)) {
    if (normalizedOccurredAt.length > 10) {
      throw new Error(
        `Invalid occurredAt: unix-seconds strings must not look like millisecond timestamps, got ${JSON.stringify(occurredAt)}`,
      )
    }

    const parsedSeconds = BigInt(normalizedOccurredAt)
    if (parsedSeconds <= 0n) {
      throw new Error(
        `Invalid occurredAt: unix-seconds must be a positive integer, got ${JSON.stringify(occurredAt)}`,
      )
    }

    return parsedSeconds
  }

  if (!isoUtcPattern.test(normalizedOccurredAt)) {
    throw new Error(
      `Invalid occurredAt: expected UTC ISO-8601 or unix-seconds string, got ${JSON.stringify(occurredAt)}`,
    )
  }

  const parsedTimestamp = Date.parse(normalizedOccurredAt)
  if (Number.isNaN(parsedTimestamp)) {
    throw new Error(
      `Invalid occurredAt: expected unix-seconds string or ISO-8601 timestamp, got ${JSON.stringify(occurredAt)}`,
    )
  }

  return BigInt(Math.floor(parsedTimestamp / 1000))
}

function buildInteractionRecordScVal(
  payload: WorkerInteractionPayload,
): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("amount"),
      val: nativeToScVal(normalizeAmount(payload.amount), { type: "i128" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("consumer_address"),
      val: nativeToScVal(payload.consumerAddress, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("provider_address"),
      val: nativeToScVal(payload.providerAddress, { type: "address" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("service_label"),
      val:
        payload.serviceLabel === undefined
          ? xdr.ScVal.scvVoid()
          : nativeToScVal(payload.serviceLabel, { type: "string" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("timestamp"),
      val: nativeToScVal(normalizeOccurredAtToUnixSeconds(payload.occurredAt), {
        type: "u64",
      }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tx_hash"),
      val: xdr.ScVal.scvBytes(normalizeTransactionHashToBytes(payload.txHash)),
    }),
  ])
}

export async function submitInteractionToContract(
  config: RelayerConfig,
  payload: WorkerInteractionPayload,
  options: SubmitInteractionOptions = {},
): Promise<SubmitInteractionResult> {
  const mode = normalizeSubmissionMode(options.mode)
  const timeoutInSeconds = normalizeTimeoutInSeconds(options.timeoutInSeconds)
  const server = new Server(config.rpcUrl)
  const relayerKeypair = Keypair.fromSecret(config.relayerSecretKey)
  const relayerAddress = relayerKeypair.publicKey()
  const interactionRecordArg = buildInteractionRecordScVal(payload)

  try {
    const sourceAccount = await server.getAccount(relayerAddress)
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: config.contractId,
          function: "register_interaction",
          args: [
            nativeToScVal(relayerAddress, { type: "address" }),
            interactionRecordArg,
          ],
        }),
      )
      .setTimeout(timeoutInSeconds)
      .build()

    const preparedTransaction = await server.prepareTransaction(transaction)
    preparedTransaction.sign(relayerKeypair)

    const transactionXdr = preparedTransaction.toXDR()
    if (mode === "dry-run") {
      return {
        mode,
        relayerAddress,
        transactionXdr,
      }
    }

    const submission = await server.sendTransaction(preparedTransaction)
    if (submission.status === "ERROR") {
      throw new Error(
        `sendTransaction failed with status ${submission.status} for ${submission.hash}`,
      )
    }

    const response = await server.pollTransaction(submission.hash, {
      attempts: 20,
    })
    if (response.status !== "SUCCESS") {
      throw new Error(
        `transaction did not reach SUCCESS after submission: ${response.status}`,
      )
    }

    return {
      mode,
      relayerAddress,
      transactionXdr,
      submission,
      response,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to submit register_interaction transaction: ${message}`)
  }
}
