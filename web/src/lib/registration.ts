interface AgentProfileInput {
  name: string
  description: string
  tags: string[]
  service_url: string | null
  mcp_server_url: string | null
  payment_endpoint: string | null
}

export interface RegistrationConfig {
  networkPassphrase: string
}

export interface RegistrationResult {
  txHash: string
}

const CONTRACT_ERROR_MAP: Record<number, string> = {
  1: "Contract is already initialized",
  2: "Ownership conflict — address already claimed by another agent",
  3: "Agent profile not found",
  4: "Transaction hash already exists",
  5: "Rating already submitted for this interaction",
  6: "Score must be between 1 and 100",
  7: "Unauthorized relayer",
  8: "Interaction not found",
  9: "Self-rating is not allowed",
  10: "Name exceeds 128 characters",
  11: "Description exceeds 512 characters",
  12: "Service URL exceeds 256 characters",
  13: "MCP server URL exceeds 256 characters",
  14: "Payment endpoint exceeds 256 characters",
  15: "Too many tags (max 20)",
  16: "Tag exceeds 32 characters",
  17: "Agent name is required",
  18: "Description is required",
  19: "Not the pending admin",
  20: "Admin transfer timelock has not expired",
  21: "Not the contract admin",
  22: "Address is already a relayer",
  23: "Address is not a relayer",
  24: "Profile not found",
  25: "Self-interaction is not allowed",
}

export function mapContractError(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error)
  const match = message.match(/Error\(Contract,\s*#(\d{1,2})\)/)
  if (match) {
    const code = Number(match[1])
    if (code >= 1 && code <= 25 && CONTRACT_ERROR_MAP[code]) {
      return CONTRACT_ERROR_MAP[code]
    }
  }
  return "Registration failed. Please try again."
}

export interface FormValidationError {
  field: string
  message: string
}

export interface FormInput {
  name: string
  description: string
  tags: string
  service_url: string
  mcp_server_url: string
  payment_endpoint: string
}

export function validateFormInput(input: FormInput): FormValidationError[] {
  const errors: FormValidationError[] = []

  if (!input.name.trim()) {
    errors.push({ field: "name", message: "Agent name is required" })
  } else if (input.name.trim().length > 128) {
    errors.push({ field: "name", message: "Name exceeds 128 characters" })
  }

  if (!input.description.trim()) {
    errors.push({ field: "description", message: "Description is required" })
  } else if (input.description.trim().length > 512) {
    errors.push({ field: "description", message: "Description exceeds 512 characters" })
  }

  const tags = input.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  if (tags.length > 20) {
    errors.push({ field: "tags", message: "Too many tags (max 20)" })
  }
  for (const tag of tags) {
    if (tag.length > 32) {
      errors.push({ field: "tags", message: `Tag "${tag}" exceeds 32 characters` })
    }
  }

  for (const field of ["service_url", "mcp_server_url", "payment_endpoint"] as const) {
    const value = input[field].trim()
    if (value && value.length > 256) {
      errors.push({ field, message: `${field} exceeds 256 characters` })
    }
    if (value && !isValidUrl(value)) {
      errors.push({ field, message: `${field} must be a valid URL` })
    }
  }

  return errors
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function formInputToProfileInput(input: FormInput): AgentProfileInput {
  const tags = input.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    tags,
    service_url: input.service_url.trim() || null,
    mcp_server_url: input.mcp_server_url.trim() || null,
    payment_endpoint: input.payment_endpoint.trim() || null,
  }
}

export async function buildAndPrepareRegistrationTx(
  walletAddress: string,
  profileInput: AgentProfileInput,
): Promise<string> {
  const buildTxRes = await fetch("/api/prepare-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, profileInput }),
  })
  if (!buildTxRes.ok) {
    const errData = await buildTxRes.json().catch(() => ({ error: "Unknown error" }))
    const msg = typeof errData === "object" && errData.error ? errData.error : `HTTP ${buildTxRes.status}`
    throw new Error(msg)
  }
  const data = await buildTxRes.json()
  return data.xdr as string
}

export async function submitSignedTransaction(
  signedTxXdr: string,
): Promise<RegistrationResult> {
  const submitRes = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signed_tx_xdr: signedTxXdr }),
  })
  if (!submitRes.ok) {
    const errBody = await submitRes.text().catch(() => "unknown error")
    throw new Error(`Failed to submit transaction: ${submitRes.status} ${errBody}`)
  }
  const result = await submitRes.json()
  return { txHash: (result.tx_hash ?? result.txHash) as string }
}

export function buildBadgeSnippet(publicApiUrl: string, address: string): string {
  if (!/^G[A-Z0-9]{55}$/.test(address)) {
    throw new Error(`Invalid Stellar address for badge snippet: ${address}`)
  }
  try {
    const url = new URL(publicApiUrl)
    const isLocal = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    if (!isLocal && url.protocol !== "https:") {
      throw new Error(`Invalid API URL protocol: ${publicApiUrl}`)
    }
    if (url.search || url.hash) {
      throw new Error(`API URL must not contain query or fragment: ${publicApiUrl}`)
    }
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error(`Invalid API URL for badge snippet: ${publicApiUrl}`)
  }
  const encodedAddress = address.replace(/"/g, "&quot;")
  const encodedUrl = publicApiUrl.replace(/"/g, "&quot;")
  return `<script src="${encodedUrl}/widget.js" data-address="${encodedAddress}"></script>`
}
