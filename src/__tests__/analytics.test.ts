import { describe, it, expect } from "vitest"
import { periodToTimestamp } from "../api/routes/agents.js"

describe("periodToTimestamp", () => {
  it("returns null for 'all'", () => {
    expect(periodToTimestamp("all")).toBeNull()
  })
  it("returns a timestamp ~30 days ago for '30d'", () => {
    const ts = periodToTimestamp("30d")
    expect(ts).not.toBeNull()
    const now = Math.floor(Date.now() / 1000)
    expect(now - ts!).toBeGreaterThan(29 * 86400)
    expect(now - ts!).toBeLessThan(31 * 86400)
  })
  it("returns a timestamp ~7 days ago for '7d'", () => {
    const ts = periodToTimestamp("7d")
    expect(ts).not.toBeNull()
    const now = Math.floor(Date.now() / 1000)
    expect(now - ts!).toBeGreaterThan(6 * 86400)
    expect(now - ts!).toBeLessThan(8 * 86400)
  })
  it("returns a timestamp ~90 days ago for '90d'", () => {
    const ts = periodToTimestamp("90d")
    expect(ts).not.toBeNull()
    const now = Math.floor(Date.now() / 1000)
    expect(now - ts!).toBeGreaterThan(89 * 86400)
    expect(now - ts!).toBeLessThan(91 * 86400)
  })
})
