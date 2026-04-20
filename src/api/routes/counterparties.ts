import { Hono } from "hono"
import { getRawDb } from "../../indexer/db/connection.js"
import type { CounterpartyResponse } from "../types.js"
import type { PaginatedResponse } from "../types.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

app.get("/:address", async (c) => {
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
