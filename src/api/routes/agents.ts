import { Hono } from "hono"
import { eq, desc, asc, sql } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import type { AgentResponse, PaginatedResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

function formatAgent(a: typeof agents.$inferSelect): AgentResponse {
  return {
    owner_address: a.owner_address,
    name: a.name,
    description: a.description,
    tags: JSON.parse(a.tags),
    score: a.score,
    verified_interactions_count: Number(a.verified_interactions_count),
    total_economic_volume: a.total_economic_volume,
    unique_counterparties_count: Number(a.unique_counterparties_count),
    last_interaction_timestamp: a.last_interaction_timestamp ? Number(a.last_interaction_timestamp) : null,
    created_at: Number(a.created_at),
    service_url: a.service_url,
    mcp_server_url: a.mcp_server_url,
    payment_endpoint: a.payment_endpoint,
  }
}

app.get("/", async (c) => {
  const db = c.get("db")
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100)
  const sort = c.req.query("sort") ?? "score"
  const order = c.req.query("order") === "asc" ? asc : desc

  const sortMap: Record<string, any> = {
    score: agents.score,
    interactions: agents.verified_interactions_count,
    volume: sql`CAST(${agents.total_economic_volume} AS REAL)`,
    created: agents.created_at,
  }
  const sortColumn = sortMap[sort] ?? agents.score

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(agents)
  const rows = await db
    .select()
    .from(agents)
    .orderBy(order(sortColumn))
    .limit(limit + 1)
  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map(formatAgent)

  return c.json<PaginatedResponse<AgentResponse>>({
    data,
    cursor: hasMore && data.length > 0 ? encodeURIComponent(String(data[data.length - 1].owner_address)) : null,
    total,
  })
})

app.get("/:address", async (c) => {
  const db = c.get("db")
  const address = c.req.param("address")
  const row = await db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!row) return c.json({ error: "Agent not found" }, 404)
  return c.json<AgentResponse>(formatAgent(row))
})

export default app
