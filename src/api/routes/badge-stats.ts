import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { computeTrustTier } from "../types.js"
import type { BadgeStatsResponse } from "../types.js"
import { isValidStellarAddress } from "../validate.js"

type Variables = { db: any }

const app = new Hono<{ Variables: Variables }>()

app.get("/:address", async (c) => {
  const address = c.req.param("address")
  if (!isValidStellarAddress(address)) return c.json({ error: "Invalid Stellar address" }, 400)
  const db = c.get("db")
  const row = db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!row) return c.json({ error: "Agent not found" }, 404)

  const tier = computeTrustTier(
    Number(row.verified_interactions_count),
    row.score,
    Number(row.unique_counterparties_count),
  )

  const response: BadgeStatsResponse = {
    address: row.owner_address,
    name: row.name,
    trust_tier: tier,
    score: row.score,
    verified_interactions_count: Number(row.verified_interactions_count),
    total_economic_volume: row.total_economic_volume,
    total_counterparties: Number(row.unique_counterparties_count),
  }

  return c.json(response)
})

export default app
