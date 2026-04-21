import { Server } from "@stellar/stellar-sdk/rpc"
import { AgentPassportIndexer } from "./indexer.js"
import type { IndexerConfig } from "./types.js"
import { getDatabase } from "./db/connection.js"
import { fetchLatestLedger, fetchContractEvents } from "./events.js"
import { eq } from "drizzle-orm"
import { indexerWatermark } from "./db/schema.js"

export async function syncHistorical(config: IndexerConfig, startLedger?: number): Promise<void> {
  const db = getDatabase()
  const watermark = db.select().from(indexerWatermark).where(eq(indexerWatermark.key, "main")).get()

  let fromLedger: number
  if (startLedger !== undefined) {
    fromLedger = startLedger
  } else if (watermark && watermark.ledger > 0) {
    fromLedger = watermark.ledger + 1
    console.log(`Resuming from stored watermark: ledger ${fromLedger}`)
  } else {
    const isLocal = config.rpcUrl.startsWith("http://localhost") || config.rpcUrl.startsWith("http://127.0.0.1")
    const server = new Server(config.rpcUrl, { allowHttp: isLocal })
    const latest = await fetchLatestLedger(server)
    const probe = await fetchContractEvents(server, config.contractId, Math.max(1, latest - 1000), latest)
    fromLedger = probe.oldestLedger
    console.log(`No watermark found. Starting from RPC oldest available ledger: ${fromLedger}`)
  }

  const indexer = new AgentPassportIndexer(config)
  let current = fromLedger
  let totalProcessed = 0

  while (true) {
    const batch = await indexer.processEvents(current, current + 100000)
    totalProcessed += batch
    console.log(`  Synced to ledger ${current + 100000}: ${batch} events (total: ${totalProcessed})`)
    if (batch === 0) break
    current += 100001
  }

  console.log(`Historical sync complete. ${totalProcessed} events processed.`)
}
