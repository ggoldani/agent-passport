// TODO(I6): Track stellar-sdk updates for axios CVE fixes (GHSA-3p68-rc4w-qgx5, GHSA-fvcv-3m26-pcqx).
// HTTPS enforcement below mitigates the primary risk. Revisit when stellar-sdk v16+ drops.
import {
  BASE_FEE,
  Keypair,
  Operation,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import { Server } from "@stellar/stellar-sdk/rpc"

import { buildMethodArgs } from "./scval.js"
import type {
  AgentPassportMethodArgs,
  AgentPassportMethodResult,
  AgentPassportReadMethodName,
  AgentPassportTransport,
  AgentPassportWriteMethodName,
} from "./agent-passport.js"

export interface SorobanRpcTransportConfig {
  rpcUrl: string
  networkPassphrase: string
  signerSecretKey: string
  timeoutSeconds?: number
}

const DEFAULT_TIMEOUT_SECONDS = 30

function bytesNToHex(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if ((Buffer.isBuffer(value) && value.length === 32) || (value instanceof Uint8Array && value.byteLength === 32)) {
    return Buffer.from(value).toString("hex")
  }
  if (Array.isArray(value)) return value.map(bytesNToHex)
  if (typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = bytesNToHex(v)
    }
    return result
  }
  return value
}

export class SorobanRpcTransport implements AgentPassportTransport {
  private readonly server: Server
  private readonly networkPassphrase: string
  private readonly signer: Keypair
  private readonly timeoutSeconds: number

  constructor(config: SorobanRpcTransportConfig) {
    const isLocal = config.rpcUrl.startsWith("http://localhost") || config.rpcUrl.startsWith("http://127.0.0.1")
    if (!config.rpcUrl.startsWith("https://") && !isLocal) {
      throw new Error(`RPC URL must use HTTPS (got ${config.rpcUrl}). Unencrypted connections are not supported.`)
    }
    this.server = new Server(config.rpcUrl, { allowHttp: isLocal })
    this.networkPassphrase = config.networkPassphrase
    this.signer = Keypair.fromSecret(config.signerSecretKey)
    this.timeoutSeconds = config.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS
  }

  async read<M extends AgentPassportReadMethodName>(
    contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    const sourceAccount = await this.server.getAccount(
      this.signer.publicKey(),
    )
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args: buildMethodArgs(method, args),
        }),
      )
      .setTimeout(this.timeoutSeconds)
      .build()

    const simulation = await this.server.simulateTransaction(transaction)
    if (!("result" in simulation)) {
      throw new Error(
        `Simulation failed for ${method}: ${"error" in simulation ? simulation.error : "unknown error"}`,
      )
    }

    if (simulation.result === undefined) {
      throw new Error(`Simulation failed for ${method}: no result returned`)
    }

    return bytesNToHex(scValToNative(
      simulation.result.retval,
    )) as AgentPassportMethodResult[M]
  }

  async write<M extends AgentPassportWriteMethodName>(
    contractId: string,
    method: M,
    args: AgentPassportMethodArgs[M],
  ): Promise<AgentPassportMethodResult[M]> {
    const sourceAccount = await this.server.getAccount(
      this.signer.publicKey(),
    )
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: method,
          args: buildMethodArgs(method, args),
        }),
      )
      .setTimeout(this.timeoutSeconds)
      .build()

    const preparedTransaction =
      await this.server.prepareTransaction(transaction)
    preparedTransaction.sign(this.signer)

    const submission = await this.server.sendTransaction(preparedTransaction)
    if (submission.status === "ERROR") {
      throw new Error(
        `Transaction failed for ${method}: status=${submission.status} hash=${submission.hash}`,
      )
    }

    const response = await this.server.pollTransaction(submission.hash, {
      attempts: 20,
    })
    if (response.status !== "SUCCESS") {
      throw new Error(
        `Transaction did not succeed for ${method}: status=${response.status} hash=${submission.hash}`,
      )
    }

    return undefined as AgentPassportMethodResult[M]
  }
}
