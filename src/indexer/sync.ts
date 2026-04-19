import { Server } from "@stellar/stellar-sdk/rpc"
import { AgentPassportIndexer } from "./indexer.js"
import type { IndexerConfig } from "./types.js"
import { getDatabase } from "./db/connection.js"
import { fetchLatestLedger } from "./events.js"
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
    fromLedger = Math.max(0, latest - 172800)
    console.log(`No watermark found. Backfilling last ~7 days from ledger ${fromLedger}`)
  }

  const indexer = new AgentPassportIndexer(config)
  console.log(`Starting historical sync from ledger ${fromLedger}...`)
  const processed = await indexer.processEvents(fromLedger, fromLedger + 100000)
  console.log(`Historical sync complete. ${processed} events processed.`)
}
