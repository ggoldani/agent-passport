import { Hono } from "hono"
import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { agents } from "../../indexer/db/schema.js"
import * as schema from "../../indexer/db/schema.js"
import { formatAgent } from "../types.js"
import type { TrustCheckResponse } from "../types.js"

type Variables = { db: BetterSQLite3Database<typeof schema> }

const app = new Hono<{ Variables: Variables }>()

app.get("/:address", async (c) => {
  const db = c.get("db")
  const address = c.req.param("address")
  const threshold = Math.max(0, Math.min(Number(c.req.query("threshold")) || 50, 100))
  const minInteractions = Math.max(0, Number(c.req.query("minInteractions")) || 0)

  const row = db.select().from(agents).where(eq(agents.owner_address, address)).get()
  if (!row) return c.json({ error: "Agent not found" }, 404)

  const agent = formatAgent(row)
  const trusted = agent.score >= threshold && agent.verified_interactions_count >= minInteractions

  const response: TrustCheckResponse = {
    trusted,
    address: agent.owner_address,
    name: agent.name,
    score: agent.score,
    trust_tier: agent.trust_tier,
    verified_interactions: agent.verified_interactions_count,
    unique_counterparties: agent.unique_counterparties_count,
    last_active: agent.last_interaction_timestamp,
    checked_at: new Date().toISOString(),
  }

  return c.json(response)
})

export default app
