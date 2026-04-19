import { eq, sql } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
type Db = BetterSQLite3Database<any>
import { agents, interactions, ratings } from "./db/schema.js"
import type { RawEvent } from "./events.js"
import {
  decodeTopicAddress,
  decodeTopicHash,
  decodeEventValueFields,
} from "./events.js"

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
    const fields = decodeEventValueFields(event.value)
    name = String(fields[0] ?? "")
    description = String(fields[1] ?? "")
    tags = JSON.stringify(Array.isArray(fields[2]) ? fields[2] : [])
    serviceUrl = fields[3] != null ? String(fields[3]) : null
    mcpServerUrl = fields[4] != null ? String(fields[4]) : null
    paymentEndpoint = fields[5] != null ? String(fields[5]) : null
    createdAt = Number(fields[6] ?? 0)
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
    const fields = decodeEventValueFields(event.value)
    txHash = typeof fields[0] === "string"
      ? fields[0]
      : Buffer.isBuffer(fields[0]) || fields[0] instanceof Uint8Array
        ? Buffer.from(fields[0]).toString("hex")
        : String(fields[0])
    amount = String(fields[1] ?? "0")
    timestamp = Number(fields[2] ?? 0)
    serviceLabel = fields[3] != null ? String(fields[3]) : null
  } catch (e) {
    console.error("Failed to parse InteractionRegistered event value:", e)
    return
  }

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
}

export function handleRatingSubmitted(db: Db, event: RawEvent): void {
  const providerAddress = decodeTopicAddress(event.topic[1])
  const consumerAddress = decodeTopicAddress(event.topic[2])
  const interactionTxHash = decodeTopicHash(event.topic[3])
  if (!providerAddress || !consumerAddress || !interactionTxHash) return

  let score = 0
  let timestamp = 0

  try {
    const fields = decodeEventValueFields(event.value)
    score = Number(fields[0] ?? 0)
    timestamp = Number(fields[1] ?? 0)
  } catch (e) {
    console.error("Failed to parse RatingSubmitted event value:", e)
    return
  }

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
}
