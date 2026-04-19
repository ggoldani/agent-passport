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

export class SorobanRpcTransport implements AgentPassportTransport {
  private readonly server: Server
  private readonly networkPassphrase: string
  private readonly signer: Keypair
  private readonly timeoutSeconds: number

  constructor(config: SorobanRpcTransportConfig) {
    this.server = new Server(config.rpcUrl)
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

    return scValToNative(
      simulation.result.retval,
    ) as AgentPassportMethodResult[M]
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
