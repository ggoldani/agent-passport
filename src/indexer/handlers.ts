import { eq, sql } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
type Db = BetterSQLite3Database<any>
import { agents, interactions, ratings } from "./db/schema.js"
import type { RawEvent } from "./events.js"
import { decodeTopicAddress, decodeTopicHash, decodeEventValue } from "./events.js"

export function handleAgentRegistered(db: Db, event: RawEvent): void {
  const ownerAddress = decodeTopicAddress(event.topic[1])
  if (!ownerAddress) return

  let name = ""
  let description = ""
  let tags = "[]"
  let serviceUrl: string | null = null
  let mcpServerUrl: string | null = null
  let paymentEndpoint: string | null = null
  let createdAt = 0

  try {
    const fields = decodeEventValue(event)
    name = String(fields.name ?? "")
    description = String(fields.description ?? "")
    tags = JSON.stringify(Array.isArray(fields.tags) ? fields.tags : [])
    serviceUrl = fields.service_url != null ? String(fields.service_url) : null
    mcpServerUrl = fields.mcp_server_url != null ? String(fields.mcp_server_url) : null
    paymentEndpoint = fields.payment_endpoint != null ? String(fields.payment_endpoint) : null
    createdAt = Number(fields.created_at ?? 0)
  } catch (e) {
    console.error("Failed to parse AgentRegistered event value:", e)
    return
  }

  const now = Math.floor(Date.now() / 1000)

  db.insert(agents)
    .values({
      owner_address: ownerAddress,
      name,
      description,
      tags,
      service_url: serviceUrl,
      mcp_server_url: mcpServerUrl,
      payment_endpoint: paymentEndpoint,
      created_at: createdAt,
      score: 0,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: agents.owner_address,
      set: {
        name,
        description,
        tags,
        service_url: serviceUrl,
        mcp_server_url: mcpServerUrl,
        payment_endpoint: paymentEndpoint,
        updated_at: now,
      },
    })
    .run()
}

export function handleInteractionRegistered(db: Db, event: RawEvent): void {
  const providerAddress = decodeTopicAddress(event.topic[1])
  const consumerAddress = decodeTopicAddress(event.topic[2])
  if (!providerAddress || !consumerAddress) return

  let txHash = ""
  let amount = "0"
  let timestamp = 0
  let serviceLabel: string | null = null

  try {
    const fields = decodeEventValue(event)
    const rawHash = fields.tx_hash
    txHash = typeof rawHash === "string"
      ? rawHash
      : Buffer.isBuffer(rawHash) || rawHash instanceof Uint8Array
        ? Buffer.from(rawHash).toString("hex")
        : String(rawHash)
    amount = String(fields.amount ?? "0")
    timestamp = Number(fields.timestamp ?? 0)
    serviceLabel = fields.service_label != null ? String(fields.service_label) : null
  } catch (e) {
    console.error("Failed to parse InteractionRegistered event value:", e)
    return
  }

  db.transaction(() => {
    const insertResult = db.insert(interactions)
      .values({
        provider_address: providerAddress,
        consumer_address: consumerAddress,
        tx_hash: txHash,
        amount,
        timestamp,
        service_label: serviceLabel,
        ledger: event.ledger,
      })
      .onConflictDoNothing()
      .run()

    if (insertResult.changes === 0) return

    const currentVolume = BigInt(db.select({ v: agents.total_economic_volume })
      .from(agents).where(eq(agents.owner_address, providerAddress)).get()?.v ?? "0")
    const newVolume = (currentVolume + BigInt(amount)).toString()
    const now = Math.floor(Date.now() / 1000)

    db.update(agents)
      .set({
        verified_interactions_count: sql`${agents.verified_interactions_count} + 1`,
        total_economic_volume: newVolume,
        last_interaction_timestamp: timestamp,
        updated_at: now,
        unique_counterparties_count: sql`(
          SELECT COUNT(*) FROM (
            SELECT DISTINCT consumer_address FROM interactions
            WHERE provider_address = ${providerAddress}
          )
        )`,
      })
      .where(eq(agents.owner_address, providerAddress))
      .run()
  })
}

export function handleRatingSubmitted(db: Db, event: RawEvent): void {
  const providerAddress = decodeTopicAddress(event.topic[1])
  const consumerAddress = decodeTopicAddress(event.topic[2])
  const interactionTxHash = decodeTopicHash(event.topic[3])
  if (!providerAddress || !consumerAddress || !interactionTxHash) return

  let score = 0
  let timestamp = 0

  try {
    const fields = decodeEventValue(event)
    score = Number(fields.score ?? 0)
    timestamp = Number(fields.timestamp ?? 0)
  } catch (e) {
    console.error("Failed to parse RatingSubmitted event value:", e)
    return
  }

  db.transaction(() => {
    const ratingInsertResult = db.insert(ratings)
      .values({
        provider_address: providerAddress,
        consumer_address: consumerAddress,
        interaction_tx_hash: interactionTxHash,
        score,
        timestamp,
        ledger: event.ledger,
      })
      .onConflictDoNothing()
      .run()

    if (ratingInsertResult.changes === 0) return

    const now = Math.floor(Date.now() / 1000)

    db.update(agents)
      .set({
        score: sql`(SELECT COALESCE(CAST(AVG(score) AS INTEGER), 0) FROM ratings WHERE provider_address = ${providerAddress})`,
        updated_at: now,
      })
      .where(eq(agents.owner_address, providerAddress))
      .run()
  })
}
