import { Hono } from "hono"
import { sql, desc, asc } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { formatAgent } from "../types.js"
import type { PaginatedResponse, AgentResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

app.get("/", async (c) => {
  const db = c.get("db")
  const q = c.req.query("q")?.trim()
  const tags = c.req.query("tags")?.trim().split(",").filter(Boolean)
  const minScore = Number(c.req.query("minScore")) || 0
  const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 20, 100))
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

  return c.json<PaginatedResponse<AgentResponse>>({ data, total, has_more: hasMore })
})

export default app
