import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createApiServer } from "../api/server.js"
import { getRawDb } from "../indexer/db/connection.js"

const ADDR = "0x1111111111111111111111111111111111111111"
const COUNTERPARTY = "0x2222222222222222222222222222222222222222"
const OLD_COUNTERPARTY = "0x3333333333333333333333333333333333333333"
const now = Math.floor(Date.now() / 1000)
const DAY = 86400

let app: ReturnType<typeof createApiServer>

beforeAll(() => {
  app = createApiServer(":memory:")
  const rawDb = getRawDb()

  rawDb.prepare(
    `INSERT INTO agents (owner_address, name, description, tags, created_at, score, verified_interactions_count, total_economic_volume, unique_counterparties_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(ADDR, "Test Agent", "Test", "[]", now, 80, 0, "0", 0, now)

  for (let i = 1; i <= 5; i++) {
    rawDb.prepare(
      `INSERT INTO interactions (provider_address, consumer_address, tx_hash, amount, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ADDR, COUNTERPARTY, `tx-${i}`, String(i * 10), now - (5 - i) * DAY, 1)
  }

  rawDb.prepare(
    `INSERT INTO interactions (provider_address, consumer_address, tx_hash, amount, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ADDR, OLD_COUNTERPARTY, "tx-old", "99.0", now - 200 * DAY, 1)

  rawDb.prepare(
    `INSERT INTO ratings (provider_address, consumer_address, interaction_tx_hash, score, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ADDR, COUNTERPARTY, "rxtx-1", 5, now - 2 * DAY, 1)
  rawDb.prepare(
    `INSERT INTO ratings (provider_address, consumer_address, interaction_tx_hash, score, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ADDR, COUNTERPARTY, "rxtx-2", 4, now - 3 * DAY, 1)
  rawDb.prepare(
    `INSERT INTO ratings (provider_address, consumer_address, interaction_tx_hash, score, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ADDR, COUNTERPARTY, "rxtx-3", 5, now - 4 * DAY, 1)

  rawDb.prepare(
    `INSERT INTO ratings (provider_address, consumer_address, interaction_tx_hash, score, timestamp, ledger) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ADDR, OLD_COUNTERPARTY, "rxtx-old", 1, now - 200 * DAY, 1)
})

afterAll(() => {
  getRawDb().close()
})

async function get(path: string) {
  return app.request(path)
}

describe("analytics route", () => {
  it("returns 400 for invalid period", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=invalid`)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain("Invalid period")
  })

  it("returns 404 for non-existent agent", async () => {
    const res = await get("/agents/0x0000000000000000000000000000000000000000/stats")
    expect(res.status).toBe(404)
  })

  it("defaults to 30d period", async () => {
    const res = await get(`/agents/${ADDR}/stats`)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.period).toBe("30d")
  })

  it("returns correct response shape", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=30d`)
    expect(res.status).toBe(200)
    const body = await res.json() as any

    expect(body.address).toBe(ADDR)
    expect(body.period).toBe("30d")
    expect(typeof body.total_interactions).toBe("number")
    expect(typeof body.total_volume).toBe("string")
    expect(typeof body.unique_counterparties).toBe("number")
    expect(body.avg_rating === null || typeof body.avg_rating === "number").toBe(true)
    expect(body.rating_distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 })
    expect(Array.isArray(body.interactions_by_day)).toBe(true)
    for (const entry of body.interactions_by_day) {
      expect(typeof entry.date).toBe("string")
      expect(typeof entry.count).toBe("number")
    }
  })

  it("filters by period — 7d excludes old data", async () => {
    const res7d = await get(`/agents/${ADDR}/stats?period=7d`)
    const resAll = await get(`/agents/${ADDR}/stats?period=all`)

    const body7d = await res7d.json() as any
    const bodyAll = await resAll.json() as any

    expect(body7d.total_interactions).toBeLessThan(bodyAll.total_interactions)
    expect(body7d.unique_counterparties).toBeLessThan(bodyAll.unique_counterparties)
  })

  it("all period includes everything", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=all`)
    const body = await res.json() as any

    expect(body.total_interactions).toBe(6)
    expect(body.unique_counterparties).toBe(2)
  })

  it("computes avg_rating correctly", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=30d`)
    const body = await res.json() as any
    expect(body.avg_rating).toBeCloseTo(4.67, 1)
  })

  it("rating_distribution includes score 1 for all period", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=all`)
    const body = await res.json() as any
    expect(body.rating_distribution[1]).toBe(1)
  })

  it("interactions_by_day is sorted ascending by date", async () => {
    const res = await get(`/agents/${ADDR}/stats?period=30d`)
    const body = await res.json() as any
    const dates = body.interactions_by_day.map((d: any) => d.date)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true)
    }
  })
})
