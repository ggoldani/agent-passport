export interface StellarMcpClientConfigEnv {
  STELLAR_MCP_URL?: string
}

export interface StellarMcpClientConfig {
  baseUrl: string
  mcpEndpointUrl: string
  healthEndpointUrl: string
}

function readRequiredEnvVar(
  env: StellarMcpClientConfigEnv,
  key: keyof StellarMcpClientConfigEnv,
): string {
  const value = env[key]

  if (value === undefined) {
    throw new Error(`Missing required env var: ${String(key)}`)
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error(`Required env var must not be blank: ${String(key)}`)
  }

  return normalized
}

function normalizeAbsoluteUrl(urlValue: string, envKey: string): URL {
  try {
    return new URL(urlValue)
  } catch {
    throw new Error(
      `Invalid ${envKey}: expected an absolute URL, got ${JSON.stringify(urlValue)}`,
    )
  }
}

function normalizeBasePath(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, "")

  if (normalizedPath === "" || normalizedPath === "/") {
    return ""
  }

  if (normalizedPath.endsWith("/mcp")) {
    const basePath = normalizedPath.slice(0, -"/mcp".length)
    return basePath === "" ? "" : basePath
  }

  return normalizedPath
}

function buildEndpointUrl(parsedUrl: URL, endpointPath: "/mcp" | "/health"): string {
  const basePath = normalizeBasePath(parsedUrl.pathname)
  const endpointUrl = new URL(parsedUrl.toString())

  endpointUrl.pathname = `${basePath}${endpointPath}` || endpointPath
  endpointUrl.search = ""
  endpointUrl.hash = ""

  return endpointUrl.toString()
}

export function loadStellarMcpClientConfig(
  env: StellarMcpClientConfigEnv,
): StellarMcpClientConfig {
  const parsedUrl = normalizeAbsoluteUrl(
    readRequiredEnvVar(env, "STELLAR_MCP_URL"),
    "STELLAR_MCP_URL",
  )
  const baseUrl = new URL(parsedUrl.toString())

  baseUrl.pathname = normalizeBasePath(baseUrl.pathname) || "/"
  baseUrl.search = ""
  baseUrl.hash = ""

  return {
    baseUrl: baseUrl.toString(),
    mcpEndpointUrl: buildEndpointUrl(parsedUrl, "/mcp"),
    healthEndpointUrl: buildEndpointUrl(parsedUrl, "/health"),
  }
}

export class StellarMcpClient {
  readonly baseUrl: string
  readonly mcpEndpointUrl: string
  readonly healthEndpointUrl: string

  constructor(config: StellarMcpClientConfig) {
    this.baseUrl = config.baseUrl
    this.mcpEndpointUrl = config.mcpEndpointUrl
    this.healthEndpointUrl = config.healthEndpointUrl
  }

  static fromEnv(env: StellarMcpClientConfigEnv): StellarMcpClient {
    return new StellarMcpClient(loadStellarMcpClientConfig(env))
  }
}
