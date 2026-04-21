import { Hono } from "hono"
import { eq, desc, asc, sql } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { formatAgent } from "../types.js"
import type { PaginatedResponse, AgentResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

app.get("/", async (c) => {
  const db = c.get("db")
  const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 20, 100))
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

  return c.json<PaginatedResponse<AgentResponse>>({ data, total, has_more: hasMore })
})

app.get("/:address", async (c) => {
  const db = c.get("db")
  const address = c.req.param("address")
  const row = await db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!row) return c.json({ error: "Agent not found" }, 404)
  return c.json(formatAgent(row))
})

export default app
