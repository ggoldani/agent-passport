import { createMiddleware } from "hono/factory"

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()
const CLEANUP_MS = 300_000
let lastCleanup = Date.now()

export function rateLimit(opts: { windowMs: number; max: number }) {
  return createMiddleware(async (c, next) => {
    const now = Date.now()

    if (now - lastCleanup > CLEANUP_MS) {
      for (const [key, bucket] of buckets) {
        if (now - bucket.lastRefill > opts.windowMs * 2) buckets.delete(key)
      }
      lastCleanup = now
    }

    const apiKey = c.req.header("x-api-key")
    const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? c.req.header("x-real-ip") ?? "anonymous"
    const key = apiKey ?? ip
    let bucket = buckets.get(key)

    if (!bucket) {
      bucket = { tokens: opts.max, lastRefill: now }
      buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    bucket.tokens = Math.min(opts.max, bucket.tokens + (elapsed / opts.windowMs) * opts.max)
    bucket.lastRefill = now

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) * opts.windowMs / opts.max / 1000)
      c.header("Retry-After", String(retryAfter))
      c.header("X-RateLimit-Limit", String(opts.max))
      c.header("X-RateLimit-Remaining", "0")
      return c.json({ error: "Rate limit exceeded", retry_after_seconds: retryAfter }, 429)
    }

    bucket.tokens -= 1
    c.header("X-RateLimit-Limit", String(opts.max))
    c.header("X-RateLimit-Remaining", String(Math.floor(bucket.tokens)))
    await next()
  })
}
