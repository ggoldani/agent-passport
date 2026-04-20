import type Database from "better-sqlite3"
import type { RichRatingRecord } from "../sdk/types.js"
import { getRawDb } from "../indexer/db/connection.js"

export function isValidRichRatingRecord(obj: unknown): obj is RichRatingRecord {
  if (typeof obj !== "object" || obj === null) return false
  const r = obj as Record<string, unknown>
  if (typeof r.provider_address !== "string") return false
  if (typeof r.consumer_address !== "string") return false
  if (typeof r.interaction_tx_hash !== "string") return false
  if (typeof r.score !== "number" || r.score < 0 || r.score > 100) return false
  if (r.quality !== null && (typeof r.quality !== "number" || r.quality < 1 || r.quality > 5)) return false
  if (r.speed !== null && (typeof r.speed !== "number" || r.speed < 1 || r.speed > 5)) return false
  if (r.reliability !== null && (typeof r.reliability !== "number" || r.reliability < 1 || r.reliability > 5)) return false
  if (r.communication !== null && (typeof r.communication !== "number" || r.communication < 1 || r.communication > 5)) return false
  if (r.comment !== null && typeof r.comment !== "string") return false
  if (typeof r.submitted_at !== "string") return false
  return true
}

export class RichRatingStore {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  submit(record: RichRatingRecord): void {
    this.db.prepare(`
      INSERT INTO rich_ratings (interaction_tx_hash, provider_address, consumer_address, quality, speed, reliability, communication, comment, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interaction_tx_hash) DO UPDATE SET
        quality = excluded.quality,
        speed = excluded.speed,
        reliability = excluded.reliability,
        communication = excluded.communication,
        comment = excluded.comment
    `).run(
      record.interaction_tx_hash.toLowerCase(),
      record.provider_address,
      record.consumer_address,
      record.quality,
      record.speed,
      record.reliability,
      record.communication,
      record.comment,
      Math.floor(new Date(record.submitted_at).getTime() / 1000),
    )
  }

  getByInteraction(txHash: string): RichRatingRecord | undefined {
    const row = this.db.prepare(
      "SELECT * FROM rich_ratings WHERE interaction_tx_hash = ?"
    ).get(txHash.toLowerCase()) as any
    if (!row) return undefined
    return {
      provider_address: row.provider_address,
      consumer_address: row.consumer_address,
      interaction_tx_hash: row.interaction_tx_hash,
      score: row.score ?? 0,
      quality: row.quality,
      speed: row.speed,
      reliability: row.reliability,
      communication: row.communication,
      comment: row.comment,
      submitted_at: new Date(row.submitted_at * 1000).toISOString(),
    }
  }

  getByProvider(address: string): RichRatingRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM rich_ratings WHERE provider_address = ?"
    ).all(address.toLowerCase()) as any[]
    return rows.map(r => ({
      provider_address: r.provider_address,
      consumer_address: r.consumer_address,
      interaction_tx_hash: r.interaction_tx_hash,
      score: r.score ?? 0,
      quality: r.quality,
      speed: r.speed,
      reliability: r.reliability,
      communication: r.communication,
      comment: r.comment,
      submitted_at: new Date(r.submitted_at * 1000).toISOString(),
    }))
  }
}

let storeInstance: RichRatingStore | null = null

export function loadRichRatingStore(): RichRatingStore {
  if (storeInstance === null) {
    storeInstance = new RichRatingStore(getRawDb())
  }
  return storeInstance
}
