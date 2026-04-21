import { Hono } from "hono"
import { eq, desc, sql } from "drizzle-orm"
import { ratings } from "../../indexer/db/schema.js"
import type { RatingResponse, PaginatedResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

function formatRating(r: typeof ratings.$inferSelect): RatingResponse {
  return {
    provider_address: r.provider_address,
    consumer_address: r.consumer_address,
    interaction_tx_hash: r.interaction_tx_hash,
    score: r.score,
    timestamp: Number(r.timestamp),
  }
}

app.get("/", async (c) => {
  const db = c.get("db")
  const providerAddress = c.req.param("address")!
  const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 20, 100))

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratings)
    .where(eq(ratings.provider_address, providerAddress))

  const rows = await db
    .select()
    .from(ratings)
    .where(eq(ratings.provider_address, providerAddress))
    .orderBy(desc(ratings.timestamp))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map(formatRating)

  return c.json<PaginatedResponse<RatingResponse>>({ data, total, has_more: hasMore })
})

export default app
