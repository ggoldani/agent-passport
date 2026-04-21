import { Hono } from "hono"
import { eq, desc, asc, sql } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { getRawDb } from "../../indexer/db/connection.js"
import { formatAgent } from "../types.js"
import type { PaginatedResponse, AgentResponse, CounterpartyResponse } from "../types.js"

type Variables = { db: any }

function sanitizeFtsQuery(input: string): string {
  let sanitized = input.replace(/["*()]/g, " ").replace(/\s+/g, " ").trim()
  const tokens = sanitized.split(" ").filter(t => t.length > 0)
  if (tokens.length === 0) return ""
  return tokens.map(t => `"${t}"`).join(" ")
}

export function periodToTimestamp(period: string): number | null {
  if (period === "all") return null
  const now = Math.floor(Date.now() / 1000)
  const days: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 }
  const d = days[period]
  if (!d) return null
  return now - d * 86400
}

const app = new Hono<{ Variables: Variables }>()

app.get("/", async (c) => {
  const db = c.get("db")
  const q = c.req.query("q")?.trim()
  const tags = c.req.query("tags")?.trim().split(",").filter(Boolean)
  const minScore = c.req.query("minScore") != null ? Number(c.req.query("minScore")) : 0
  const maxScore = c.req.query("maxScore") != null ? Number(c.req.query("maxScore")) : 100
  const minInteractions = c.req.query("minInteractions") != null ? Number(c.req.query("minInteractions")) : 0
  const maxInteractions = c.req.query("maxInteractions") != null ? Number(c.req.query("maxInteractions")) : Number.MAX_SAFE_INTEGER
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
  const address = c.req.param("address")
  const period = c.req.query("period") ?? "30d"

  const validPeriods = ["7d", "30d", "90d", "all"]
  if (!validPeriods.includes(period)) {
    return c.json({ error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` }, 400)
  }

  const db = c.get("db")
  const agent = db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!agent) return c.json({ error: "Agent not found" }, 404)

  const minTimestamp = periodToTimestamp(period)
  const useWeekBuckets = period === "all"
  const dateExpr = useWeekBuckets
    ? "strftime('%Y-W%W', timestamp, 'unixepoch')"
    : "date(timestamp, 'unixepoch', 'start of day')"
  const ratingDateExpr = useWeekBuckets
    ? "strftime('%Y-W%W', timestamp, 'unixepoch')"
    : "date(timestamp, 'unixepoch', 'start of day')"

  const rawDb = getRawDb()

  const volumeRows = minTimestamp !== null
    ? rawDb.prepare(
        `SELECT ${dateExpr} as date, SUM(CAST(amount AS REAL)) as volume
         FROM interactions WHERE provider_address = ? AND timestamp >= ?
         GROUP BY date ORDER BY date ASC LIMIT 90`
      ).all(address, minTimestamp) as Array<{ date: string; volume: number }>
    : rawDb.prepare(
        `SELECT ${dateExpr} as date, SUM(CAST(amount AS REAL)) as volume
         FROM interactions WHERE provider_address = ?
         GROUP BY date ORDER BY date ASC LIMIT 90`
      ).all(address) as Array<{ date: string; volume: number }>

  const counterpartyParams = minTimestamp !== null
    ? [address, minTimestamp, address, minTimestamp]
    : [address, address]
  const counterpartyWhere1 = minTimestamp !== null ? "AND timestamp >= ?" : ""
  const counterpartyWhere2 = minTimestamp !== null ? "AND timestamp >= ?" : ""
  const counterpartyDateExpr = useWeekBuckets
    ? "strftime('%Y-W%W', timestamp, 'unixepoch')"
    : "date(timestamp, 'unixepoch', 'start of day')"

  const counterpartyRows = rawDb.prepare(
    `SELECT date, COUNT(DISTINCT counterparty) as unique_counterparties
     FROM (
       SELECT ${counterpartyDateExpr} as date, consumer_address as counterparty
       FROM interactions WHERE provider_address = ? ${counterpartyWhere1}
       UNION ALL
       SELECT ${counterpartyDateExpr} as date, provider_address as counterparty
       FROM interactions WHERE consumer_address = ? ${counterpartyWhere2}
     )
     GROUP BY date ORDER BY date ASC LIMIT 90`
  ).all(...counterpartyParams) as Array<{ date: string; unique_counterparties: number }>

  const scoreTrajectoryParams = minTimestamp !== null
    ? [address, minTimestamp]
    : [address]
  const scoreTrajectoryWhere = minTimestamp !== null ? "AND timestamp >= ?" : ""

  const scoreRows = rawDb.prepare(
    `SELECT ${ratingDateExpr} as date, AVG(score) as score
     FROM ratings WHERE provider_address = ? ${scoreTrajectoryWhere}
     GROUP BY date ORDER BY date ASC LIMIT 90`
  ).all(...scoreTrajectoryParams) as Array<{ date: string; score: number }>

  const ratingWhere = minTimestamp !== null ? "AND submitted_at >= ?" : ""
  const ratingBreakdownParams = minTimestamp !== null ? [address, minTimestamp] : [address]

  const ratingBreakdown = rawDb.prepare(
    `SELECT AVG(quality) as quality_avg, COUNT(quality) as quality_count,
            AVG(speed) as speed_avg, COUNT(speed) as speed_count,
            AVG(reliability) as reliability_avg, COUNT(reliability) as reliability_count,
            AVG(communication) as communication_avg, COUNT(communication) as communication_count
     FROM rich_ratings WHERE provider_address = ? ${ratingWhere}`
  ).get(...ratingBreakdownParams) as any

  const avgRatingParams = minTimestamp !== null
    ? [address, minTimestamp]
    : [address]
  const avgRatingWhere = minTimestamp !== null ? "AND timestamp >= ?" : ""

  const avgRatingRow = rawDb.prepare(
    `SELECT AVG(score) as avg_score FROM ratings WHERE provider_address = ? ${avgRatingWhere}`
  ).get(...avgRatingParams) as { avg_score: number | null }

  const summaryWhere = minTimestamp !== null ? "AND timestamp >= ?" : ""
  const summaryParams = minTimestamp !== null ? [address, minTimestamp] : [address]

  const summaryRow = rawDb.prepare(
    `SELECT CAST(COUNT(*) AS INTEGER) as interactions,
            cast(cast(sum(cast(amount as real)) as integer) as text) as volume,
            COUNT(DISTINCT consumer_address) as counterparties
     FROM interactions WHERE provider_address = ? ${summaryWhere}`
  ).get(...summaryParams) as { interactions: number; volume: string; counterparties: number }

  const response: import("../types.js").AnalyticsResponse = {
    address,
    period,
    volume_over_time: volumeRows.map(r => ({ date: r.date, volume: String(r.volume) })),
    counterparty_growth: counterpartyRows,
    score_trajectory: scoreRows,
    rating_breakdown: {
      quality: { avg: ratingBreakdown?.quality_avg ?? 0, count: ratingBreakdown?.quality_count ?? 0 },
      speed: { avg: ratingBreakdown?.speed_avg ?? 0, count: ratingBreakdown?.speed_count ?? 0 },
      reliability: { avg: ratingBreakdown?.reliability_avg ?? 0, count: ratingBreakdown?.reliability_count ?? 0 },
      communication: { avg: ratingBreakdown?.communication_avg ?? 0, count: ratingBreakdown?.communication_count ?? 0 },
    },
    summary: {
      total_volume: summaryRow?.volume ?? "0",
      total_interactions: summaryRow?.interactions ?? 0,
      unique_counterparties: summaryRow?.counterparties ?? 0,
      avg_rating: avgRatingRow?.avg_score ? Math.round((avgRatingRow.avg_score / 20) * 10) / 10 : 0,
    },
  }

  return c.json(response)
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
