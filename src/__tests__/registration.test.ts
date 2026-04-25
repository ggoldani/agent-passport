import { describe, it, expect } from "vitest"
import { validateFormInput, buildBadgeSnippet, mapContractError } from "../../web/src/lib/registration.js"

const validInput = {
  name: "My Agent",
  description: "A helpful AI agent",
  tags: "analytics, data",
  service_url: "https://example.com/agent",
  mcp_server_url: "",
  payment_endpoint: "",
}

describe("validateFormInput", () => {
  it("returns error for empty name", () => {
    const errors = validateFormInput({ ...validInput, name: " " })
    expect(errors).toEqual([{ field: "name", message: "Agent name is required" }])
  })

  it("returns error for empty description", () => {
    const errors = validateFormInput({ ...validInput, description: "   " })
    expect(errors).toEqual([{ field: "description", message: "Description is required" }])
  })

  it("returns error for name exceeding 128 characters", () => {
    const errors = validateFormInput({ ...validInput, name: "a".repeat(129) })
    expect(errors).toEqual([{ field: "name", message: "Name exceeds 128 characters" }])
  })

  it("returns error for description exceeding 512 characters", () => {
    const errors = validateFormInput({ ...validInput, description: "a".repeat(513) })
    expect(errors).toEqual([{ field: "description", message: "Description exceeds 512 characters" }])
  })

  it("returns error for too many tags (>20)", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`).join(", ")
    const errors = validateFormInput({ ...validInput, tags })
    expect(errors).toEqual([{ field: "tags", message: "Too many tags (max 20)" }])
  })

  it("returns error for tag exceeding 32 characters", () => {
    const longTag = "a".repeat(33)
    const errors = validateFormInput({ ...validInput, tags: longTag })
    expect(errors).toEqual([
      { field: "tags", message: `Tag "${longTag}" exceeds 32 characters` },
    ])
  })

  it("reports ALL oversized tags", () => {
    const longTag1 = "a".repeat(33)
    const longTag2 = "b".repeat(34)
    const errors = validateFormInput({ ...validInput, tags: `${longTag1},${longTag2}` })
    expect(errors).toHaveLength(2)
    expect(errors[0].field).toBe("tags")
    expect(errors[1].field).toBe("tags")
  })

  it("returns error for invalid service_url", () => {
    const errors = validateFormInput({ ...validInput, service_url: "not-a-url" })
    expect(errors).toEqual([{ field: "service_url", message: "service_url must be a valid URL" }])
  })

  it("returns error for service_url exceeding 256 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(256)
    const errors = validateFormInput({ ...validInput, service_url: longUrl })
    expect(errors).toEqual([{ field: "service_url", message: "service_url exceeds 256 characters" }])
  })

  it("returns no errors for all valid input", () => {
    expect(validateFormInput(validInput)).toEqual([])
  })

  it("returns no errors when optional fields are empty", () => {
    const input = { ...validInput, service_url: "", mcp_server_url: "", payment_endpoint: "" }
    expect(validateFormInput(input)).toEqual([])
  })

  it("returns multiple errors for multiple invalid fields", () => {
    const errors = validateFormInput({ ...validInput, name: "", description: "" })
    expect(errors).toHaveLength(2)
    expect(errors.map((e) => e.field)).toEqual(["name", "description"])
  })
})

describe("buildBadgeSnippet", () => {
  it("returns correct HTML for valid input", () => {
    const address = "G" + "A".repeat(55)
    const result = buildBadgeSnippet("https://api.example.com", address)
    expect(result).toBe(
      `<script src="https://api.example.com/widget.js" data-address="${address}"></script>`,
    )
  })

  it("throws for non-G address", () => {
    expect(() => buildBadgeSnippet("https://api.example.com", "SABC123")).toThrow(
      "Invalid Stellar address for badge snippet",
    )
  })

  it("throws for address that is too short", () => {
    expect(() => buildBadgeSnippet("https://api.example.com", "G" + "A".repeat(54))).toThrow(
      "Invalid Stellar address for badge snippet",
    )
  })

  it("throws for HTTP URL", () => {
    const address = "G" + "A".repeat(55)
    expect(() => buildBadgeSnippet("http://api.example.com", address)).toThrow(
      "Invalid API URL protocol",
    )
  })

  it("throws for URL with query string", () => {
    const address = "G" + "A".repeat(55)
    expect(() => buildBadgeSnippet("https://api.example.com?foo=bar", address)).toThrow(
      "API URL must not contain query or fragment",
    )
  })

  it("throws for URL with fragment", () => {
    const address = "G" + "A".repeat(55)
    expect(() => buildBadgeSnippet("https://api.example.com#section", address)).toThrow(
      "API URL must not contain query or fragment",
    )
  })

  it("includes data-address attribute with the full address", () => {
    const address = "G" + "A".repeat(55)
    const result = buildBadgeSnippet("https://api.example.com", address)
    expect(result).toContain(`data-address="${address}"`)
    expect(result).toContain("widget.js")
  })
})

describe("mapContractError", () => {
  it("maps Soroban contract error code to friendly message", () => {
    const error = new Error("HostError: Error(Contract, #2)")
    expect(mapContractError(error)).toBe("Ownership conflict — address already claimed by another agent")
  })

  it("returns generic message for non-contract errors with numbers", () => {
    const error = new Error("timeout after 30 seconds")
    expect(mapContractError(error)).toBe("Registration failed. Please try again.")
  })

  it("returns generic message for errors without contract format", () => {
    const error = new Error("RPC error: connection refused on port 8080")
    expect(mapContractError(error)).toBe("Registration failed. Please try again.")
  })

  it("returns generic message for non-Error input", () => {
    expect(mapContractError("something went wrong")).toBe("Registration failed. Please try again.")
  })
})
