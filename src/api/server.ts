import { Hono } from "hono"
import { cors } from "hono/cors"
import { eq } from "drizzle-orm"
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "../indexer/db/schema.js"
import { ratings } from "../indexer/db/schema.js"
import { getDatabase } from "../indexer/db/connection.js"
import { rateLimit } from "./middleware/rate-limit.js"
import { isValidStellarAddress } from "./validate.js"
import healthRoutes from "./routes/health.js"
import agentsRoutes from "./routes/agents.js"
import interactionsRoutes from "./routes/interactions.js"
import ratingsRoutes from "./routes/ratings.js"
import trustCheckRoutes from "./routes/trust-check.js"
import badgeRoutes from "./routes/badge.js"
import badgeStatsRoutes from "./routes/badge-stats.js"
import registerRoutes from "./routes/register.js"
import { WIDGET_JS } from "./widget.js"

type Variables = { db: BetterSQLite3Database<typeof schema> }

export function createApiServer(dbPath?: string) {
  const db = getDatabase(dbPath)

  const app = new Hono<{ Variables: Variables }>()
  if (process.env.CORS_ORIGINS) {
    const allowedOrigins = process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    app.use("*", cors({ origin: allowedOrigins }))
  } else {
    app.use("*", cors({ origin: (origin) => origin === undefined ? undefined : null }))
  }
  app.use("*", async (c, next) => {
    c.set("db", db)
    await next()
  })

  const SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  }

  app.use("*", async (c, next) => {
    await next()
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(key, value)
    }
  })

  app.use("*", rateLimit({ windowMs: 60_000, max: 300, db }))
  app.use("/agents/*", rateLimit({ windowMs: 60_000, max: 60, db }))
  app.use("/register", rateLimit({ windowMs: 60_000, max: 10, db }))

  app.get("/widget.js", (c) => {
    return c.body(WIDGET_JS, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    })
  })

  app.route("/", healthRoutes)
  app.route("/trust-check", trustCheckRoutes)
  app.route("/badge", badgeRoutes)
  app.route("/badge-stats", badgeStatsRoutes)
  app.route("/register", registerRoutes)

  app.use("/agents/:address/*", async (c, next) => {
    const address = c.req.param("address")
    if (address && !isValidStellarAddress(address)) {
      return c.json({ error: "Invalid Stellar address format" }, 400)
    }
    await next()
  })
  app.use("/trust-check/:address/*", async (c, next) => {
    const address = c.req.param("address")
    if (address && !isValidStellarAddress(address)) {
      return c.json({ error: "Invalid Stellar address format" }, 400)
    }
    await next()
  })

  app.route("/agents/:address/interactions", interactionsRoutes)
  app.route("/agents/:address/ratings", ratingsRoutes)
  app.route("/agents", agentsRoutes)

  app.onError((err, c) => {
    console.error("Unhandled API error:", err)
    return c.json({ error: "Internal server error" }, 500)
  })

  app.get("/ratings/:txHash", async (c) => {
    const db = c.get("db")
    const txHash = c.req.param("txHash")
    if (!/^[0-9a-fA-F]{64}$/.test(txHash)) {
      return c.json({ error: "Invalid transaction hash format" }, 400)
    }
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
