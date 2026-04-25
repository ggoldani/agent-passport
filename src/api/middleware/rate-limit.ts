import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { agents } from "../../indexer/db/schema.js"
import type * as schema from "../../indexer/db/schema.js"
import { isValidStellarAddress } from "../validate.js"
import { computeTrustTier } from "../types.js"

interface Bucket {
  tokens: number
  lastRefill: number
}

interface TierCacheEntry {
  tier: string
  fetchedAt: number
}

const buckets = new Map<string, Bucket>()
const CLEANUP_MS = 300_000
let lastCleanup = Date.now()

const tierCache = new Map<string, TierCacheEntry>()
const TIER_CACHE_TTL_MS = 60_000

const PRIORITY_MULTIPLIER = 2

export type RateLimitConfig = {
  windowMs: number
  max: number
  db?: BetterSQLite3Database<typeof schema>
}

export function rateLimit(opts: RateLimitConfig) {
  return createMiddleware(async (c, next) => {
    const now = Date.now()

    if (now - lastCleanup > CLEANUP_MS) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.lastRefill > opts.windowMs * 2) buckets.delete(key)
      }
      for (const [key, entry] of tierCache) {
        if (now - entry.fetchedAt > TIER_CACHE_TTL_MS) tierCache.delete(key)
      }
      lastCleanup = now
    }

    const forwarded = c.req.header("x-forwarded-for")
    const realIp = c.req.header("x-real-ip")
    const connIp = c.req.header("x-hono-remote-addr")
    const ip = connIp ?? realIp ?? (forwarded ? forwarded.split(",")[0]?.trim() ?? "anonymous" : "anonymous")
    const agentAddress = c.req.header("x-agent-address")

    let isPriority = false
    if (agentAddress && opts.db && isValidStellarAddress(agentAddress)) {
      try {
        isPriority = await checkPriorityTier(agentAddress, opts.db, now)
      } catch {
        isPriority = false
      }
    }

    const effectiveMax = isPriority ? opts.max * PRIORITY_MULTIPLIER : opts.max
    const key = `${ip}:${isPriority ? "priority" : "standard"}`

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { tokens: effectiveMax, lastRefill: now }
      buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    bucket.tokens = Math.min(effectiveMax, bucket.tokens + (elapsed / opts.windowMs) * effectiveMax)
    bucket.lastRefill = now

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) * opts.windowMs / effectiveMax / 1000)
      c.header("Retry-After", String(retryAfter))
      c.header("X-RateLimit-Limit", String(effectiveMax))
      c.header("X-RateLimit-Remaining", "0")
      return c.json({ error: "Rate limit exceeded", retry_after_seconds: retryAfter }, 429)
    }

    bucket.tokens -= 1
    c.header("X-RateLimit-Limit", String(effectiveMax))
    c.header("X-RateLimit-Remaining", String(Math.floor(bucket.tokens)))
    await next()
  })
}

async function checkPriorityTier(address: string, db: BetterSQLite3Database<typeof schema>, now: number): Promise<boolean> {
  const cached = tierCache.get(address)
  if (cached && now - cached.fetchedAt < TIER_CACHE_TTL_MS) {
    return cached.tier === "trusted"
  }

  const row = db.select({
    verified_interactions_count: agents.verified_interactions_count,
    score: agents.score,
    unique_counterparties_count: agents.unique_counterparties_count,
  }).from(agents).where(eq(agents.owner_address, address)).get()

  const isTrusted = row !== undefined
    && computeTrustTier(Number(row.verified_interactions_count), row.score, Number(row.unique_counterparties_count)) === "trusted"

  tierCache.set(address, { tier: isTrusted ? "trusted" : "standard", fetchedAt: now })
  return isTrusted
}
