import { Hono } from "hono"
import { cors } from "hono/cors"
import { eq } from "drizzle-orm"
import { ratings } from "../indexer/db/schema.js"
import { getDatabase } from "../indexer/db/connection.js"
import { rateLimit } from "./middleware/rate-limit.js"
import healthRoutes from "./routes/health.js"
import agentsRoutes from "./routes/agents.js"
import interactionsRoutes from "./routes/interactions.js"
import ratingsRoutes from "./routes/ratings.js"
import searchRoutes from "./routes/search.js"

type Variables = { db: any }

export function createApiServer(dbPath?: string) {
  const db = getDatabase(dbPath)

  const app = new Hono<{ Variables: Variables }>()
  app.use("*", cors())
  app.use("*", async (c, next) => {
    c.set("db", db)
    await next()
  })

  app.use("*", rateLimit({ windowMs: 60_000, max: 300 }))
  app.use("/search/*", rateLimit({ windowMs: 60_000, max: 60 }))

  app.route("/", healthRoutes)
  app.route("/agents", agentsRoutes)
  app.route("/agents/:address/interactions", interactionsRoutes)
  app.route("/agents/:address/ratings", ratingsRoutes)
  app.route("/search", searchRoutes)

  app.get("/ratings/:txHash", async (c) => {
    const db = c.get("db")
    const txHash = c.req.param("txHash")
    const row = db.select().from(ratings).where(eq(ratings.interaction_tx_hash, txHash)).get()
    if (!row) return c.json({ error: "Rating not found" }, 404)
    return c.json({
      provider_address: row.provider_address,
      consumer_address: row.consumer_address,
      interaction_tx_hash: row.interaction_tx_hash,
      score: row.score,
      timestamp: Number(row.timestamp),
    })
  })

  return app
}
