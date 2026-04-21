import { Server } from "@stellar/stellar-sdk/rpc"
import { Keypair, nativeToScVal, BASE_FEE, Operation, TransactionBuilder, scValToNative } from "@stellar/stellar-sdk"
import { AgentPassportIndexer } from "./indexer.js"
import type { IndexerConfig } from "./types.js"
import { getDatabase } from "./db/connection.js"
import { fetchLatestLedger, fetchContractEvents } from "./events.js"
import { eq, sql } from "drizzle-orm"
import { indexerWatermark, agents, interactions } from "./db/schema.js"
import { applyEnvFile } from "../lib/env.js"

export async function syncHistorical(config: IndexerConfig, startLedger?: number): Promise<void> {
  applyEnvFile()
  const db = getDatabase()
  const watermark = db.select().from(indexerWatermark).where(eq(indexerWatermark.key, "main")).get()

  let fromLedger: number
  const isLocal = config.rpcUrl.startsWith("http://localhost") || config.rpcUrl.startsWith("http://127.0.0.1")
  const server = new Server(config.rpcUrl, { allowHttp: isLocal })

  if (startLedger !== undefined) {
    fromLedger = startLedger
  } else if (watermark && watermark.ledger > 0) {
    fromLedger = watermark.ledger + 1
    console.log(`Resuming from stored watermark: ledger ${fromLedger}`)
  } else {
    const latest = await fetchLatestLedger(server)
    const probe = await fetchContractEvents(server, config.contractId, Math.max(1, latest - 1000), latest)
    fromLedger = probe.oldestLedger ?? latest
    if (fromLedger <= 0) fromLedger = Math.max(1, latest - 1000)
    console.log(`No watermark found. Starting from RPC oldest available ledger: ${fromLedger}`)
  }

  const indexer = new AgentPassportIndexer(config)
  let current = fromLedger
  let totalProcessed = 0

  while (true) {
    let latest: number
    try {
      latest = await fetchLatestLedger(server)
    } catch {
      console.error(`  Failed to fetch latest ledger at ${current}, retrying in 5s...`)
      await new Promise(r => setTimeout(r, 5000))
      continue
    }
    const endLedger = Math.min(current + 100000, latest)
    if (current > latest) break
    const batch = await indexer.processEvents(current, endLedger)
    totalProcessed += batch
    console.log(`  Synced to ledger ${endLedger}: ${batch} events (total: ${totalProcessed})`)
    if (batch === 0 && current >= latest) break
    current = endLedger + 1
  }

  await backfillMissingAgents(db, server, config.contractId, config.networkPassphrase)
  await recalculateAgentStats(db)

  console.log(`Historical sync complete. ${totalProcessed} events processed.`)
}

async function backfillMissingAgents(
  db: ReturnType<typeof getDatabase>,
  server: Server,
  contractId: string,
  networkPassphrase?: string,
): Promise<void> {
  const existing = new Set(
    db.select({ address: agents.owner_address }).from(agents).all().map(r => r.address),
  )

  const missingFromInteractions = db
    .selectDistinct({ address: sql<string>`provider_address` })
    .from(sql`interactions`)
    .all()
    .map(r => r.address)
    .filter(a => !existing.has(a))

  const missingFromRatings = db
    .selectDistinct({ address: sql<string>`provider_address` })
    .from(sql`ratings`)
    .all()
    .map(r => r.address)
    .filter(a => !existing.has(a))

  const missing = new Set([...missingFromInteractions, ...missingFromRatings])
  if (missing.size === 0) return

  console.log(`Backfilling ${missing.size} missing agent(s) from contract...`)

  if (!process.env.RELAYER_SECRET_KEY) {
    console.error("  RELAYER_SECRET_KEY not set — skipping agent backfill")
    return
  }

  const sourceAddress = Keypair.fromSecret(process.env.RELAYER_SECRET_KEY!).publicKey()
  const sourceAccount = await server.getAccount(sourceAddress)

  for (const address of missing) {
    const result = await backfillAgent(db, server, contractId, sourceAddress, sourceAccount, address, networkPassphrase)
    if (result) {
      console.log(`  Backfilled: ${result}`)
      await backfillAgentInteractions(db, server, contractId, sourceAddress, sourceAccount, address, networkPassphrase)
    }
  }
}

async function backfillAgentInteractions(
  db: ReturnType<typeof getDatabase>,
  server: Server,
  contractId: string,
  sourceAddress: string,
  sourceAccount: any,
  address: string,
  networkPassphrase?: string,
): Promise<number> {
  try {
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase ?? "Test SDF Network ; September 2015",
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: contractId,
          function: "list_agent_interactions",
          args: [nativeToScVal(address, { type: "address" })],
        }),
      )
      .setTimeout(30)
      .build()

    const simulation = await server.simulateTransaction(tx)
    if (!("result" in simulation)) return 0

    const records = scValToNative(simulation.result!.retval) as any[]
    if (!Array.isArray(records) || records.length === 0) return 0

    let inserted = 0
    for (const r of records) {
      if (!r?.tx_hash) continue
      const exists = db.select({ id: interactions.id }).from(interactions)
        .where(eq(interactions.tx_hash, r.tx_hash)).get()
      if (exists) continue

      db.insert(interactions).values({
        provider_address: String(r.provider_address ?? address),
        consumer_address: String(r.consumer_address ?? ""),
        tx_hash: String(r.tx_hash),
        amount: String(r.amount ?? 0),
        timestamp: Number(r.timestamp ?? 0),
        service_label: r.service_label ? String(r.service_label) : null,
        ledger: 0,
      }).run()
      inserted++
    }

    if (inserted > 0) console.log(`    Backfilled ${inserted} interaction(s)`)
    return inserted
  } catch (e: any) {
    console.error(`    Failed to backfill interactions:`, e.message?.substring(0, 100))
    return 0
  }
}

async function backfillAgent(
  db: ReturnType<typeof getDatabase>,
  server: Server,
  contractId: string,
  sourceAddress: string,
  sourceAccount: any,
  address: string,
  networkPassphrase?: string,
): Promise<string | null> {
    try {
      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: networkPassphrase ?? "Test SDF Network ; September 2015",
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: contractId,
          function: "get_agent",
          args: [nativeToScVal(address, { type: "address" })],
          }),
        )
        .setTimeout(30)
        .build()

      const simulation = await server.simulateTransaction(tx)
      if (!("result" in simulation)) return null

      const profile = scValToNative(simulation.result!.retval) as any
      if (!profile || !profile.owner_address) return null

      const now = Math.floor(Date.now() / 1000)
      db.insert(agents)
        .values({
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
          total_economic_volume: String(Math.floor(Number(profile.total_economic_volume ?? 0))),
          unique_counterparties_count: Number(profile.unique_counterparties_count ?? 0),
          last_interaction_timestamp: Number(profile.last_interaction_timestamp ?? 0) || null,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: agents.owner_address,
          set: {
            name: String(profile.name ?? ""),
            description: String(profile.description ?? ""),
            tags: JSON.stringify(Array.isArray(profile.tags) ? profile.tags : []),
            service_url: profile.service_url ?? null,
            mcp_server_url: profile.mcp_server_url ?? null,
            payment_endpoint: profile.payment_endpoint ?? null,
            verified_interactions_count: Number(profile.verified_interactions_count ?? 0),
            total_economic_volume: String(Math.floor(Number(profile.total_economic_volume ?? 0))),
            unique_counterparties_count: Number(profile.unique_counterparties_count ?? 0),
            last_interaction_timestamp: Number(profile.last_interaction_timestamp ?? 0) || null,
            updated_at: now,
          },
        })
        .run()

      return `${profile.name} (${profile.owner_address})`
    } catch (e: any) {
      console.error(`  Failed to backfill:`, e.message?.substring(0, 100))
      return null
    }
  }

function recalculateAgentStats(
  db: ReturnType<typeof getDatabase>,
): void {
  const allAddresses = db.select({ address: agents.owner_address }).from(agents).all().map(r => r.address)
  let updated = 0

  for (const address of allAddresses) {
    const stats = db
      .select({
        interactions: sql<number>`count(*)`,
        volume: sql<string>`cast(cast(sum(cast(amount as real)) as integer) as text)`,
        counterparties: sql<number>`count(distinct consumer_address)`,
        lastTs: sql<number | null>`max(timestamp)`,
      })
      .from(sql`interactions`)
      .where(sql`provider_address = ${address}`)
      .get() as any

    const current = db.select().from(agents).where(eq(agents.owner_address, address)).get()
    if (!current) continue

    const needsUpdate =
      Number(current.verified_interactions_count) !== Number(stats?.interactions ?? 0) ||
      current.total_economic_volume !== (stats?.volume ?? "0") ||
      Number(current.unique_counterparties_count) !== Number(stats?.counterparties ?? 0)

    if (needsUpdate) {
      db.update(agents)
        .set({
          verified_interactions_count: Number(stats?.interactions ?? 0),
          total_economic_volume: stats?.volume ?? "0",
          unique_counterparties_count: Number(stats?.counterparties ?? 0),
          last_interaction_timestamp: stats?.lastTs ?? null,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .where(eq(agents.owner_address, address))
        .run()
      updated++
    }
  }

  if (updated > 0) console.log(`Recalculated stats for ${updated} agent(s)`)
}
