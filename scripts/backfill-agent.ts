import { applyEnvFile } from "../src/lib/env.js"
import { Server } from "@stellar/stellar-sdk/rpc"
import { getDatabase } from "../src/indexer/db/connection.js"
import { agents } from "../src/indexer/db/schema.js"
import { sql } from "drizzle-orm"
import { scValToNative, nativeToScVal, TransactionBuilder, Operation, BASE_FEE } from "@stellar/stellar-sdk"
import { Keypair } from "@stellar/stellar-sdk"

applyEnvFile()

const rpcUrl = process.env.STELLAR_RPC_URL || ""
const contractId = process.env.CONTRACT_ID || ""
const secret = process.env.RELAYER_SECRET_KEY || ""
const network = process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015"

if (!rpcUrl || !contractId || !secret) {
  console.error("Missing STELLAR_RPC_URL, CONTRACT_ID, or RELAYER_SECRET_KEY")
  process.exit(1)
}

async function main() {
  const server = new Server(rpcUrl, { allowHttp: true })
  const db = getDatabase()
  const kp = Keypair.fromSecret(secret)
  const sourceAccount = await server.getAccount(kp.publicKey())

  const address = process.argv[2]
  if (!address) {
    console.error("Usage: npx tsx scripts/backfill-agent.ts <G...address>")
    process.exit(1)
  }

  const existing = db.select({ address: agents.owner_address, name: agents.name }).from(agents).where(sql`${agents.owner_address} = ${address}`).get()
  if (existing) {
    console.log(`Agent ${address} already in DB: ${existing.name}`)
    process.exit(0)
  }

  const tx = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase: network })
    .addOperation(Operation.invokeContractFunction({
      contract: contractId,
      function: "get_agent",
      args: [nativeToScVal(address, { type: "address" })],
    }))
    .setTimeout(30)
    .build()

  const simulation = await server.simulateTransaction(tx)
  if (!("result" in simulation) || !simulation.result?.retval) {
    console.log("Agent not found on-chain")
    process.exit(1)
  }

  const profile = scValToNative(simulation.result.retval) as any
  if (!profile?.owner_address) {
    console.log("Invalid profile returned")
    process.exit(1)
  }

  const now = Math.floor(Date.now() / 1000)
  db.insert(agents).values({
    owner_address: profile.owner_address,
    name: String(profile.name ?? ""),
    description: String(profile.description ?? ""),
    tags: JSON.stringify(Array.isArray(profile.tags) ? profile.tags : []),
    service_url: profile.service_url ?? null,
    mcp_server_url: profile.mcp_server_url ?? null,
    payment_endpoint: profile.payment_endpoint ?? null,
    created_at: Number(profile.created_at ?? 0),
    score: Number(profile.score ?? 0),
    verified_interactions_count: Number(profile.verified_interactions_count ?? 0),
    total_economic_volume: String(BigInt(profile.total_economic_volume ?? 0)),
    unique_counterparties_count: Number(profile.unique_counterparties_count ?? 0),
    last_interaction_timestamp: Number(profile.last_interaction_timestamp ?? 0) || null,
    updated_at: now,
  }).run()

  console.log(`Backfilled: ${profile.name} (${profile.owner_address})`)
}

main().catch(e => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error("Error:", msg.substring(0, 200))
  process.exit(1)
})
