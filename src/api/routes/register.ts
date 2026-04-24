import { Hono } from "hono"
import { TransactionBuilder, StrKey, Operation, Transaction } from "@stellar/stellar-sdk"
import { Server } from "@stellar/stellar-sdk/rpc"
import { xdr } from "@stellar/stellar-sdk"

const CONTRACT_ID = process.env.CONTRACT_ID
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE
const RPC_URL = process.env.STELLAR_RPC_URL

const CONTRACT_ERROR_MAP: Record<number, { status: number; message: string }> = {
  2: { status: 409, message: "This address is already registered" },
  17: { status: 400, message: "Agent name is required" },
  18: { status: 400, message: "Description is required" },
  10: { status: 400, message: "Name exceeds 128 characters" },
  11: { status: 400, message: "Description exceeds 512 characters" },
  12: { status: 400, message: "Service URL exceeds 256 characters" },
  13: { status: 400, message: "MCP server URL exceeds 256 characters" },
  14: { status: 400, message: "Payment endpoint exceeds 256 characters" },
  15: { status: 400, message: "Too many tags (max 20)" },
  16: { status: 400, message: "Tag exceeds 32 characters" },
}

const MAX_XDR_LENGTH = 4096

function extractContractErrorCode(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/\b(\d{1,2})\b/g)
  if (match) {
    for (const numStr of match) {
      const code = Number(numStr)
      if (code >= 1 && code <= 25) return code
    }
  }
  return null
}

const app = new Hono()

app.post("/", async (c) => {
  if (!CONTRACT_ID || !NETWORK_PASSPHRASE || !RPC_URL) {
    return c.json({ error: "Server not configured for transaction submission" }, 500)
  }

  const body = await c.req.json<{ signed_tx_xdr?: string }>()
  const signedTxXdr = body?.signed_tx_xdr

  if (!signedTxXdr || typeof signedTxXdr !== "string") {
    return c.json({ error: "Missing or invalid signed_tx_xdr field" }, 400)
  }

  if (signedTxXdr.length > MAX_XDR_LENGTH) {
    return c.json({ error: "Transaction XDR exceeds maximum size" }, 413)
  }

  let parsed: ReturnType<typeof TransactionBuilder.fromXDR>
  try {
    parsed = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  } catch {
    return c.json({ error: "Invalid transaction XDR format" }, 400)
  }

  const transaction = parsed instanceof Transaction ? parsed : parsed.innerTransaction
  const operations = transaction.operations

  if (operations.length === 0) {
    return c.json({ error: "Transaction has no operations" }, 400)
  }

  if (operations.length !== 1) {
    return c.json({ error: "Transaction must contain exactly one operation" }, 400)
  }

  const op = operations[0] as Operation.InvokeHostFunction
  if (op.type !== "invokeHostFunction") {
    return c.json({
      error: `Transaction must invoke register_agent on contract ${CONTRACT_ID}`,
    }, 400)
  }

  const hostFunction = op.func as xdr.HostFunction
  if (hostFunction.switch().name !== "hostFunctionTypeInvokeContract") {
    return c.json({
      error: `Transaction must invoke register_agent on contract ${CONTRACT_ID}`,
    }, 400)
  }

  const invokeArgs = hostFunction.invokeContract()
  const contractAddress = invokeArgs.contractAddress()
  const contractIdBuffer = Buffer.from(new Uint8Array(contractAddress.contractId() as unknown as Uint8Array))
  const parsedContractId = StrKey.encodeContract(contractIdBuffer)
  const functionName = invokeArgs.functionName()
  const functionNameStr = typeof functionName === "string" ? functionName : functionName.toString("utf-8")

  if (parsedContractId !== CONTRACT_ID || functionNameStr !== "register_agent") {
    return c.json({
      error: `Transaction must invoke register_agent on contract ${CONTRACT_ID}`,
    }, 400)
  }

  try {
    const isLocal = RPC_URL.startsWith("http://localhost") || RPC_URL.startsWith("http://127.0.0.1")
    const server = new Server(RPC_URL, { allowHttp: isLocal })

    const submission = await server.sendTransaction(parsed)
    if (submission.status === "ERROR") {
      return c.json({ error: `Transaction rejected: ${submission.status}`, tx_hash: submission.hash }, 400)
    }

    let pollResult
    try {
      pollResult = await server.pollTransaction(submission.hash, { attempts: 20 })
    } catch (pollError: unknown) {
      console.error("Transaction polling failed:", pollError)
      const code = extractContractErrorCode(pollError)
      if (code && CONTRACT_ERROR_MAP[code]) {
        const mapped = CONTRACT_ERROR_MAP[code]
        return c.json({ error: mapped.message }, mapped.status as 400 | 409)
      }
      return c.json({ error: "Transaction polling failed" }, 502)
    }

    if (pollResult.status !== "SUCCESS") {
      return c.json({ error: "Transaction failed", tx_hash: submission.hash }, 502)
    }

    return c.json({
      tx_hash: submission.hash,
      status: "SUCCESS",
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${submission.hash}`,
    })
  } catch (error: unknown) {
    console.error("RPC error:", error)
    return c.json({ error: "Failed to submit transaction" }, 502)
  }
})

export default app
