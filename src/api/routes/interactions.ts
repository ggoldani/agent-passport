import { Hono } from "hono"
import { eq, desc, sql } from "drizzle-orm"
import { interactions } from "../../indexer/db/schema.js"
import type { InteractionResponse, PaginatedResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

function formatInteraction(i: typeof interactions.$inferSelect): InteractionResponse {
  return {
    provider_address: i.provider_address,
    consumer_address: i.consumer_address,
    tx_hash: i.tx_hash,
    amount: i.amount,
    timestamp: Number(i.timestamp),
    service_label: i.service_label,
  }
}

app.get("/", async (c) => {
  const db = c.get("db")
  const providerAddress = c.req.param("address")!
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100)

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interactions)
    .where(eq(interactions.provider_address, providerAddress))

  const rows = await db
    .select()
    .from(interactions)
    .where(eq(interactions.provider_address, providerAddress))
    .orderBy(desc(interactions.timestamp))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map(formatInteraction)

  return c.json<PaginatedResponse<InteractionResponse>>({
    data,
    cursor: hasMore && data.length > 0 ? encodeURIComponent(String(data[data.length - 1].timestamp)) : null,
    total,
  })
})

export default app
