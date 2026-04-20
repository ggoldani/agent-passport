import { Server } from "@stellar/stellar-sdk/rpc"
import { eq, sql } from "drizzle-orm"
import { agents, indexerWatermark, interactions, ratings } from "./db/schema.js"
import { getDatabase } from "./db/connection.js"
import { fetchContractEvents, fetchLatestLedger, classifyEvent } from "./events.js"
import {
  handleAgentRegistered,
  handleInteractionRegistered,
  handleRatingSubmitted,
} from "./handlers.js"
import type { IndexerConfig, IndexerStats } from "./types.js"

const WATERMARK_KEY = "main"
const DEFAULT_POLL_MS = 5000

export class AgentPassportIndexer {
  private readonly server: Server
  private readonly contractId: string
  private readonly pollMs: number
  private running = false
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(config: IndexerConfig) {
    const isLocal = config.rpcUrl.startsWith("http://localhost") || config.rpcUrl.startsWith("http://127.0.0.1")
    this.server = new Server(config.rpcUrl, { allowHttp: isLocal })
    this.contractId = config.contractId
    this.pollMs = config.pollIntervalMs ?? DEFAULT_POLL_MS
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    const db = getDatabase()
    const watermark = this.readWatermark(db)
    const latest = await fetchLatestLedger(this.server)
    console.log(`Indexer starting from ledger ${watermark + 1}, network latest: ${latest}`)
    await this.poll(db)
    this.timer = setInterval(() => this.poll(db), this.pollMs)
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async processEvents(startLedger: number, endLedger: number): Promise<number> {
    const db = getDatabase()
    let current = startLedger
    let processed = 0
    const batchSize = 100
    let lastLedger = startLedger

    while (current <= endLedger) {
      const response = await fetchContractEvents(this.server, this.contractId, current, endLedger, batchSize)

      for (const event of response.events) {
        const name = classifyEvent(event)
        if (!name || !event.inSuccessfulContractCall) continue
        switch (name) {
          case "agent_registered": handleAgentRegistered(db, event); break
          case "interaction_registered": handleInteractionRegistered(db, event); break
          case "rating_submitted": handleRatingSubmitted(db, event); break
        }
        processed++
      }

      if (response.latestLedger > lastLedger) {
        lastLedger = response.latestLedger
      }

      console.log(`  Synced ledger ${current}-${response.latestLedger}: ${response.events.length} events (${processed} total)`)

      if (response.events.length < batchSize) break
      current = response.latestLedger + 1
    }

    this.writeWatermark(db, lastLedger)
    return processed
  }

  async getStats(): Promise<IndexerStats> {
    const db = getDatabase()
    const watermark = this.readWatermark(db)
    const latest = await fetchLatestLedger(this.server).catch(() => watermark)
    const [ac] = await db.select({ count: sql<number>`count(*)` }).from(agents)
    const [ic] = await db.select({ count: sql<number>`count(*)` }).from(interactions)
    const [rc] = await db.select({ count: sql<number>`count(*)` }).from(ratings)
    return {
      currentLedger: latest,
      watermarkLedger: watermark,
      agentsCount: ac.count,
      interactionsCount: ic.count,
      ratingsCount: rc.count,
      lastPollAt: Date.now(),
    }
  }

  private async poll(db: ReturnType<typeof getDatabase>): Promise<void> {
    try {
      const watermark = this.readWatermark(db)
      const response = await fetchContractEvents(this.server, this.contractId, watermark + 1)
      let eventCount = 0
      let maxEventLedger = watermark
      for (const event of response.events) {
        const name = classifyEvent(event)
        if (!name || !event.inSuccessfulContractCall) continue
        switch (name) {
          case "agent_registered": handleAgentRegistered(db, event); break
          case "interaction_registered": handleInteractionRegistered(db, event); break
          case "rating_submitted": handleRatingSubmitted(db, event); break
        }
        eventCount++
        if (event.ledger > maxEventLedger) maxEventLedger = event.ledger
      }
      if (response.latestLedger > watermark) {
        this.writeWatermark(db, Math.max(maxEventLedger, response.latestLedger))
        if (eventCount > 0) {
          console.log(`Indexed ${eventCount} events up to ledger ${Math.max(maxEventLedger, response.latestLedger)}`)
        }
      }
    } catch (error: any) {
      if (error?.code === -32600 && error?.message?.includes("ledger range")) {
        try {
          const latest = await fetchLatestLedger(this.server).catch(() => this.readWatermark(db))
          const probe = await fetchContractEvents(this.server, this.contractId, Math.max(1, latest - 1000), latest)
          this.writeWatermark(db, probe.oldestLedger)
          console.log(`Watermark stale. Reset to RPC oldest: ${probe.oldestLedger}`)
        } catch (probeError) {
          console.error("Failed to recover stale watermark:", probeError)
        }
      } else {
        console.error("Indexer poll error:", error)
      }
    }
  }

  private readWatermark(db: ReturnType<typeof getDatabase>): number {
    const row = db.select().from(indexerWatermark).where(eq(indexerWatermark.key, WATERMARK_KEY)).get()
    return row?.ledger ?? 0
  }

  private writeWatermark(db: ReturnType<typeof getDatabase>, ledger: number): void {
    db.insert(indexerWatermark)
      .values({ key: WATERMARK_KEY, ledger, updated_at: Math.floor(Date.now() / 1000) })
      .onConflictDoUpdate({
        target: indexerWatermark.key,
        set: { ledger, updated_at: Math.floor(Date.now() / 1000) },
      })
      .run()
  }
}

export { getDatabase }
