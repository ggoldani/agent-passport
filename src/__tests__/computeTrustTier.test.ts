import { describe, it, expect } from "vitest"
import { computeTrustTier } from "../api/types.js"

describe("computeTrustTier", () => {
  it("returns 'new' for low interactions", () => {
    expect(computeTrustTier(2, 80, 10)).toBe("new")
  })

  it("returns 'new' for low score", () => {
    expect(computeTrustTier(10, 30, 5)).toBe("new")
  })

  it("returns 'active' for moderate interactions and score", () => {
    expect(computeTrustTier(8, 60, 3)).toBe("active")
  })

  it("returns 'trusted' for high interactions, score, and counterparties", () => {
    expect(computeTrustTier(25, 80, 10)).toBe("trusted")
  })

  it("returns 'active' when only interactions are high but score is mid", () => {
    expect(computeTrustTier(25, 60, 10)).toBe("active")
  })

  it("returns 'trusted' at boundary values", () => {
    expect(computeTrustTier(20, 75, 5)).toBe("trusted")
  })

  it("returns 'active' just below trusted threshold", () => {
    expect(computeTrustTier(19, 75, 5)).toBe("active")
  })

  it("returns 'new' for zero inputs", () => {
    expect(computeTrustTier(0, 0, 0)).toBe("new")
  })
})
