// TODO(I6): Track stellar-sdk updates for axios CVE fixes (GHSA-3p68-rc4w-qgx5, GHSA-fvcv-3m26-pcqx).
// HTTPS enforcement below mitigates the primary risk. Revisit when stellar-sdk v16+ drops.
import {
  BASE_FEE,
  Keypair,
  Operation,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import { createRpcServer } from "../lib/rpc.js"

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

function validateResult(method: AgentPassportReadMethodName, value: unknown): void {
  const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "object" && value !== null ? "object" : typeof value

  switch (method) {
    case "get_config":
      if (kind !== "object" || value === null || typeof (value as Record<string, unknown>).admin !== "string") {
        throw new TypeError(`RPC validation failed for get_config: expected object with "admin" string, got ${kind === "object" ? JSON.stringify(value) : kind}`)
      }
      break
    case "get_relayers":
      if (!Array.isArray(value) || value.some((v: unknown) => typeof v !== "string")) {
        throw new TypeError(`RPC validation failed for get_relayers: expected string[], got ${kind}`)
      }
      break
    case "get_agent":
      if (kind !== "object" || value === null || typeof (value as Record<string, unknown>).owner_address !== "string" || typeof (value as Record<string, unknown>).score !== "number") {
        throw new TypeError(`RPC validation failed for get_agent: expected AgentProfile with "owner_address" and "score", got ${kind === "object" ? JSON.stringify(value) : kind}`)
      }
      break
    case "list_agents":
      if (!Array.isArray(value)) {
        throw new TypeError(`RPC validation failed for list_agents: expected AgentProfile[], got ${kind}`)
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        if (typeof item !== "object" || item === null || typeof (item as Record<string, unknown>).owner_address !== "string") {
          throw new TypeError(`RPC validation failed for list_agents[${i}]: expected AgentProfile with "owner_address", got ${typeof item === "object" ? JSON.stringify(item) : typeof item}`)
        }
      }
      break
    case "get_rating":
      if (value !== null) {
        if (kind !== "object" || value === null || typeof (value as Record<string, unknown>).provider_address !== "string" || typeof (value as Record<string, unknown>).score !== "number") {
          throw new TypeError(`RPC validation failed for get_rating: expected RatingRecord or null, got ${kind === "object" ? JSON.stringify(value) : kind}`)
        }
      }
      break
  }
}

export class SorobanRpcTransport implements AgentPassportTransport {
  private readonly server: ReturnType<typeof createRpcServer>
  private readonly networkPassphrase: string
  private readonly signer: Keypair
  private readonly timeoutSeconds: number

  constructor(config: SorobanRpcTransportConfig) {
    this.server = createRpcServer(config.rpcUrl)
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

    const rawResult = scValToNative(simulation.result.retval)
    validateResult(method, rawResult)
    return bytesNToHex(rawResult) as AgentPassportMethodResult[M]
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

  async fetchApi<T>(_path: string): Promise<{ data: T; status: number }> {
    throw new Error("fetchApi() is not available via SorobanRpcTransport. Use TrustApiTransport for API calls.")
  }
}
