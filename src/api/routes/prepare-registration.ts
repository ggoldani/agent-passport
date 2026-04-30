import { Hono } from "hono"
import { BASE_FEE, Operation, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { createRpcServer } from "../../lib/rpc.js"
import { isValidStellarAddress } from "../validate.js"

function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validateProfileInput(input: Record<string, unknown>): string | null {
  if (typeof input.name !== "string" || !input.name.trim()) return "Agent name is required"
  if (input.name.trim().length > 128) return "Name exceeds 128 characters"
  if (typeof input.description !== "string" || !input.description.trim()) return "Description is required"
  if (input.description.trim().length > 512) return "Description exceeds 512 characters"

  const tags = Array.isArray(input.tags) ? input.tags : []
  if (tags.length > 20) return "Too many tags (max 20)"
  for (const tag of tags) {
    if (typeof tag !== "string" || tag.length > 32) return `Tag "${tag}" exceeds 32 characters`
  }

  for (const field of ["service_url", "mcp_server_url", "payment_endpoint"]) {
    const value = input[field]
    if (value != null && typeof value === "string" && value.trim()) {
      if (value.trim().length > 256) return `${field} exceeds 256 characters`
      if (!isValidUrl(value)) return `${field} must be a valid URL`
    }
  }

  return null
}

const app = new Hono()

app.post("/", async (c) => {
  try {
    const CONTRACT_ID = process.env.CONTRACT_ID
    const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE
    const RPC_URL = process.env.STELLAR_RPC_URL

    if (!CONTRACT_ID || !NETWORK_PASSPHRASE || !RPC_URL) {
      return c.json({ error: "Server not configured for transaction preparation" }, 500)
    }

    const body = await c.req.json<{ walletAddress?: string; profileInput?: Record<string, unknown> }>()
    const { walletAddress, profileInput } = body

    if (!walletAddress || typeof walletAddress !== "string" || !isValidStellarAddress(walletAddress)) {
      return c.json({ error: "Missing or invalid walletAddress" }, 400)
    }
    if (!profileInput || typeof profileInput !== "object") {
      return c.json({ error: "Missing or invalid profileInput" }, 400)
    }

    const validationError = validateProfileInput(profileInput)
    if (validationError) {
      return c.json({ error: validationError }, 400)
    }

    const server = createRpcServer(RPC_URL)
    const sourceAccount = await server.getAccount(walletAddress)

    const profileScVal = buildAgentProfileInputScVal(profileInput)
    const args = [
      nativeToScVal(walletAddress, { type: "address" }),
      profileScVal,
    ]

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: CONTRACT_ID,
          function: "register_agent",
          args,
        }),
      )
      .setTimeout(30)
      .build()

    const preparedTransaction = await server.prepareTransaction(transaction)
    const txXdr = preparedTransaction.toXDR()

    return c.json({ xdr: txXdr })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const contractMatch = message.match(/Error\(Contract,\s*#(\d{1,2})\)/)
    if (contractMatch) {
      const code = Number(contractMatch[1])
      const validationErrors: Record<number, string> = {
        10: "Name exceeds 128 characters",
        11: "Description exceeds 512 characters",
        17: "Agent name is required",
        18: "Description is required",
      }
      const conflictErrors: Record<number, string> = {
        2: "This address is already registered",
      }
      if (validationErrors[code]) {
        return c.json({ error: validationErrors[code] }, 400)
      }
      if (conflictErrors[code]) {
        return c.json({ error: conflictErrors[code] }, 409)
      }
    }
    console.error("[prepare-registration] Error:", message)
    return c.json({ error: "Transaction preparation failed" }, 500)
  }
})

function buildAgentProfileInputScVal(input: Record<string, unknown>): xdr.ScVal {
  const stringEntry = (key: string, value: string): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val: nativeToScVal(value, { type: "string" }),
    })

  const optionalStringEntry = (key: string, value: unknown): xdr.ScMapEntry =>
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol(key),
      val:
        value === null || value === undefined || value === ""
          ? xdr.ScVal.scvVoid()
          : nativeToScVal(String(value), { type: "string" }),
    })

  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag: unknown) => nativeToScVal(String(tag), { type: "string" }))
    : []

  return xdr.ScVal.scvMap([
    stringEntry("description", String(input.description ?? "")),
    optionalStringEntry("mcp_server_url", input.mcp_server_url),
    stringEntry("name", String(input.name ?? "")),
    optionalStringEntry("payment_endpoint", input.payment_endpoint),
    optionalStringEntry("service_url", input.service_url),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tags"),
      val: xdr.ScVal.scvVec(tags),
    }),
  ])
}

export default app
