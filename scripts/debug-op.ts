import { applyEnvFile } from "../src/lib/env.js"
applyEnvFile()

import { TransactionBuilder, BASE_FEE, Operation, xdr, StrKey, Keypair, Transaction } from "@stellar/stellar-sdk"
import { Server } from "@stellar/stellar-sdk/rpc"
import { buildMethodArgs } from "../src/sdk/scval.js"

async function main() {
  const kp = Keypair.random()
  const rpcUrl = process.env.STELLAR_RPC_URL!
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE!
  const contractId = process.env.CONTRACT_ID!
  const server = new Server(rpcUrl, { allowHttp: true })

  const resp = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`)
  console.log("Funded:", resp.ok)

  const sourceAccount = await server.getAccount(kp.publicKey())

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: "register_agent",
        args: buildMethodArgs("register_agent", [kp.publicKey(), {
          name: "Debug Op",
          description: "Debugging op.type issue",
          tags: ["debug"],
          service_url: null,
          mcp_server_url: null,
          payment_endpoint: null,
        }]),
      }),
    )
    .setTimeout(30)
    .build()

  const prepared = await server.prepareTransaction(tx)
  prepared.sign(kp)
  const xdrStr = prepared.toXDR()

  console.log("\n--- Parsing XDR back (same as register.ts) ---")
  const parsed = TransactionBuilder.fromXDR(xdrStr, networkPassphrase)
  const transaction = parsed instanceof Transaction ? parsed : parsed.innerTransaction
  const ops = transaction.operations
  console.log("Num ops:", ops.length)
  const op0 = ops[0]
  console.log("op0.type:", op0.type)
  console.log("op0 keys:", Object.keys(op0))

  if (op0.type === "invokeHostFunction") {
    const hf = op0.func as xdr.HostFunction
    console.log("hostFunction switch:", hf.switch().name)
    const invokeArgs = hf.invokeContract()
    const contractAddress = invokeArgs.contractAddress()
    const contractIdBuffer = Buffer.from(new Uint8Array(contractAddress.contractId() as unknown as Uint8Array))
    const parsedContractId = StrKey.encodeContract(contractIdBuffer)
    console.log("contract from XDR:", parsedContractId)
    console.log("contract from env:", contractId)
    console.log("match:", parsedContractId === contractId)
    console.log("function name:", invokeArgs.functionName())
  } else {
    console.log("ERROR: op0.type is not invokeHostFunction!")
    console.log("Full op:", JSON.stringify(op0, null, 2).slice(0, 500))
  }
}

main().catch(console.error)
