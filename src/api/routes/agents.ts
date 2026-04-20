import { Hono } from "hono"
import { eq, desc, asc, sql } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { getRawDb } from "../../indexer/db/connection.js"
import { formatAgent } from "../types.js"
import type { PaginatedResponse, AgentResponse, CounterpartyResponse, AnalyticsResponse } from "../types.js"

type Variables = { db: any }

function sanitizeFtsQuery(input: string): string {
  let sanitized = input.replace(/["*()]/g, " ").replace(/\s+/g, " ").trim()
  const tokens = sanitized.split(" ").filter(t => t.length > 0)
  if (tokens.length === 0) return ""
  return tokens.map(t => `"${t}"`).join(" ")
}

const app = new Hono<{ Variables: Variables }>()

app.get("/", async (c) => {
  const db = c.get("db")
  const q = c.req.query("q")?.trim()
  const tags = c.req.query("tags")?.trim().split(",").filter(Boolean)
  const minScore = Number(c.req.query("minScore")) || 0
  const maxScore = Number(c.req.query("maxScore")) || 100
  const minInteractions = Number(c.req.query("minInteractions")) || 0
  const maxInteractions = Number(c.req.query("maxInteractions")) || Number.MAX_SAFE_INTEGER
  const minVolume = c.req.query("minVolume")
  const maxVolume = c.req.query("maxVolume")
  const registeredBefore = Number(c.req.query("registeredBefore")) || 0
  const registeredAfter = Number(c.req.query("registeredAfter")) || 0
  const hasServiceUrl = c.req.query("hasServiceUrl")
  const sortBy = c.req.query("sortBy") ?? c.req.query("sort") ?? "score"
  const sortOrder = c.req.query("sortOrder") !== "asc" ? "desc" : "asc"
  const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 20, 100))

  if (sortBy === "relevance" && !q) {
    return c.json({ error: "sortBy=relevance requires a search query (q parameter)" }, 400)
  }

  let sanitizedQ: string | undefined
  if (q) {
    sanitizedQ = sanitizeFtsQuery(q)
    if (!sanitizedQ) {
      return c.json({ error: "Search query contains no valid terms" }, 400)
    }
  }

  const conditions: any[] = []

  if (sanitizedQ) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM agents_fts
      WHERE agents_fts MATCH ${sanitizedQ}
      AND agents_fts.rowid = agents.rowid
    )`)
  }

  if (tags && tags.length > 0) {
    for (const tag of tags) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM json_each(agents.tags) WHERE json_each.value = ${tag}
      )`)
    }
  }

  if (minScore > 0) conditions.push(sql`${agents.score} >= ${minScore}`)
  if (maxScore < 100) conditions.push(sql`${agents.score} <= ${maxScore}`)
  if (minInteractions > 0) conditions.push(sql`${agents.verified_interactions_count} >= ${minInteractions}`)
  if (maxInteractions < Number.MAX_SAFE_INTEGER) conditions.push(sql`${agents.verified_interactions_count} <= ${maxInteractions}`)
  if (minVolume) conditions.push(sql`CAST(${agents.total_economic_volume} AS REAL) >= CAST(${minVolume} AS REAL)`)
  if (maxVolume) conditions.push(sql`CAST(${agents.total_economic_volume} AS REAL) <= CAST(${maxVolume} AS REAL)`)
  if (registeredBefore > 0) conditions.push(sql`${agents.created_at} <= ${registeredBefore}`)
  if (registeredAfter > 0) conditions.push(sql`${agents.created_at} >= ${registeredAfter}`)
  if (hasServiceUrl === "true" || hasServiceUrl === "1" || hasServiceUrl === "") {
    conditions.push(sql`${agents.service_url} IS NOT NULL`)
  }

  const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined

  const sortColumn = sortBy === "score" ? agents.score
    : sortBy === "interactions" ? agents.verified_interactions_count
    : sortBy === "volume" ? sql`CAST(${agents.total_economic_volume} AS REAL)`
    : sortBy === "created" ? agents.created_at
    : agents.score

  const orderFn = sortOrder === "asc" ? asc : desc

  let rows: any[]

  if (q && sortBy === "relevance") {
    const rawDb = getRawDb()
    const nonFtsConditions: string[] = []
    const params: any[] = []

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        nonFtsConditions.push(`EXISTS (SELECT 1 FROM json_each(agents.tags) WHERE json_each.value = ?)`)
        params.push(tag)
      }
    }
    if (minScore > 0) { nonFtsConditions.push("agents.score >= ?"); params.push(minScore) }
    if (maxScore < 100) { nonFtsConditions.push("agents.score <= ?"); params.push(maxScore) }
    if (minInteractions > 0) { nonFtsConditions.push("agents.verified_interactions_count >= ?"); params.push(minInteractions) }
    if (maxInteractions < Number.MAX_SAFE_INTEGER) { nonFtsConditions.push("agents.verified_interactions_count <= ?"); params.push(maxInteractions) }
    if (minVolume) { nonFtsConditions.push("CAST(agents.total_economic_volume AS REAL) >= CAST(? AS REAL)"); params.push(minVolume) }
    if (maxVolume) { nonFtsConditions.push("CAST(agents.total_economic_volume AS REAL) <= CAST(? AS REAL)"); params.push(maxVolume) }
    if (registeredBefore > 0) { nonFtsConditions.push("agents.created_at <= ?"); params.push(registeredBefore) }
    if (registeredAfter > 0) { nonFtsConditions.push("agents.created_at >= ?"); params.push(registeredAfter) }
    if (hasServiceUrl === "true" || hasServiceUrl === "1" || hasServiceUrl === "") {
      nonFtsConditions.push("agents.service_url IS NOT NULL")
    }

    const whereClause = nonFtsConditions.length > 0 ? `AND ${nonFtsConditions.join(" AND ")}` : ""
    const orderClause = sortOrder === "asc" ? "ASC" : "DESC"

    rows = rawDb.prepare(
      `SELECT agents.* FROM agents_fts
       INNER JOIN agents ON agents.rowid = agents_fts.rowid
       WHERE agents_fts MATCH ? ${whereClause}
       ORDER BY bm25(agents_fts) ${orderClause}
       LIMIT ?`
    ).all(sanitizedQ!, ...params, limit + 1) as any[]
  } else {
    let query = db.select().from(agents)
    if (where) query = query.where(where)
    rows = await query.orderBy(orderFn(sortColumn)).limit(limit + 1).all()
  }

  const hasMore = rows.length > limit
  const data = rows.slice(0, limit).map(formatAgent)

  const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(agents).where(where)

  return c.json<PaginatedResponse<AgentResponse>>({ data, total, has_more: hasMore })
})

app.get("/:address/stats", async (c) => {
  const db = c.get("db")
  const address = c.req.param("address")
  const period = c.req.query("period") ?? "30d"

  const validPeriods = ["7d", "30d", "90d", "all"]
  if (!validPeriods.includes(period)) {
    return c.json({ error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` }, 400)
  }

  const agent = db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!agent) return c.json({ error: "Agent not found" }, 404)

  const rawDb = getRawDb()
  const now = Math.floor(Date.now() / 1000)

  const periodDays: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null }
  const days = periodDays[period]
  const cutoff = days !== null ? now - days * 86400 : 0
  const interactionTimeFilter = days !== null ? "AND i.timestamp >= ?" : ""
  const ratingTimeFilter = days !== null ? "AND timestamp >= ?" : ""
  const statsParams = days !== null ? [address, address, cutoff] : [address, address]
  const ratingParams = days !== null ? [address, cutoff] : [address]

  const stats = rawDb.prepare(
    `SELECT
       COUNT(*) as total_interactions,
       COALESCE(SUM(CAST(i.amount AS REAL)), 0) as total_volume,
       COUNT(DISTINCT CASE WHEN i.provider_address = ? THEN i.consumer_address ELSE i.provider_address END) as unique_counterparties
     FROM interactions i
     WHERE (i.provider_address = ? OR i.consumer_address = ?)
     ${interactionTimeFilter}`
  ).get(address, ...statsParams) as { total_interactions: number; total_volume: number; unique_counterparties: number }

  const ratingRow = rawDb.prepare(
    `SELECT AVG(score) as avg_rating FROM ratings WHERE provider_address = ? ${ratingTimeFilter}`
  ).get(...ratingParams) as { avg_rating: number | null }

  const ratingDistRows = rawDb.prepare(
    `SELECT score, COUNT(*) as count FROM ratings WHERE provider_address = ? ${ratingTimeFilter} GROUP BY score`
  ).all(...ratingParams) as Array<{ score: number; count: number }>

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of ratingDistRows) {
    if (r.score >= 1 && r.score <= 5) ratingDistribution[r.score as 1 | 2 | 3 | 4 | 5] = r.count
  }

  const maxDays = days !== null ? days : 90
  const interactionsByDay = rawDb.prepare(
    `SELECT date(i.timestamp, 'unixepoch') as date, COUNT(*) as count
     FROM interactions i
     WHERE (i.provider_address = ? OR i.consumer_address = ?)
     ${interactionTimeFilter}
     GROUP BY date(i.timestamp, 'unixepoch')
     ORDER BY date ASC
     LIMIT ?`
  ).all(...statsParams, maxDays) as Array<{ date: string; count: number }>

  const response: AnalyticsResponse = {
    address,
    period,
    total_interactions: stats.total_interactions,
    total_volume: String(stats.total_volume),
    unique_counterparties: stats.unique_counterparties,
    avg_rating: ratingRow.avg_rating !== null ? Math.round(ratingRow.avg_rating * 100) / 100 : null,
    rating_distribution: ratingDistribution,
    interactions_by_day: interactionsByDay,
  }

  return c.json<AnalyticsResponse>(response)
})

app.get("/:address", async (c) => {
  const db = c.get("db")
  const address = c.req.param("address")
  const row = await db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!row) return c.json({ error: "Agent not found" }, 404)
  return c.json(formatAgent(row))
})

app.get("/:address/counterparties", async (c) => {
  const rawDb = getRawDb()
  const address = c.req.param("address")
  const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 10, 50))

  const rows = rawDb.prepare(
    `SELECT
      counterparty_address as address,
      SUM(interaction_count) as interaction_count,
      SUM(total_volume) as total_volume,
      MAX(is_registered) as is_registered_agent
    FROM (
      SELECT
        consumer_address as counterparty_address,
        COUNT(*) as interaction_count,
        SUM(CAST(amount AS REAL)) as total_volume,
        CAST(EXISTS (SELECT 1 FROM agents WHERE owner_address = consumer_address) AS INTEGER) as is_registered
      FROM interactions
      WHERE provider_address = ?
      GROUP BY consumer_address
      UNION ALL
      SELECT
        provider_address as counterparty_address,
        COUNT(*) as interaction_count,
        SUM(CAST(amount AS REAL)) as total_volume,
        CAST(EXISTS (SELECT 1 FROM agents WHERE owner_address = provider_address) AS INTEGER) as is_registered
      FROM interactions
      WHERE consumer_address = ?
      GROUP BY provider_address
    ) combined
    GROUP BY counterparty_address
    ORDER BY interaction_count DESC
    LIMIT ?`
  ).all(address, address, limit + 1) as Array<{
    address: string
    interaction_count: number
    total_volume: number
    is_registered_agent: number
  }>

  const hasMore = rows.length > limit
  const data: CounterpartyResponse[] = rows.slice(0, limit).map(r => ({
    address: r.address,
    interaction_count: r.interaction_count,
    total_volume: String(r.total_volume),
    is_registered_agent: r.is_registered_agent === 1,
  }))

  return c.json<PaginatedResponse<CounterpartyResponse>>({
    data,
    total: data.length,
    has_more: hasMore,
  })
})

export default app
