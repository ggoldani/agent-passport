import { Hono } from "hono"
import { sql, desc, asc } from "drizzle-orm"
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
  const q = c.req.query("q")?.trim()
  const tags = c.req.query("tags")?.trim().split(",").filter(Boolean)
  const minScore = Number(c.req.query("minScore")) || 0
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100)
  const sortBy = c.req.query("sortBy") ?? "score"
  const sortOrder = c.req.query("sortOrder") !== "asc" ? "desc" : "asc"

  const conditions = []
  if (q) {
    conditions.push(sql`(name LIKE '%' || ${q} || '%' OR description LIKE '%' || ${q} || '%')`)
  }
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      conditions.push(sql`tags LIKE '%' || ${tag} || '%'`)
    }
  }
  if (minScore > 0) {
    conditions.push(sql`score >= ${minScore}`)
  }

  const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined

  const sortColumn = sortBy === "score" ? agents.score
    : sortBy === "interactions" ? agents.verified_interactions_count
    : sortBy === "volume" ? sql`CAST(${agents.total_economic_volume} AS REAL)`
    : agents.created_at
  const orderFn = sortOrder === "asc" ? asc : desc

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(agents).where(where)
  const rows = await db
    .select()
    .from(agents)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map(formatAgent)

  return c.json<PaginatedResponse<AgentResponse>>({
    data,
    cursor: hasMore && data.length > 0 ? encodeURIComponent(String(data[data.length - 1].owner_address)) : null,
    total,
  })
})

export default app
