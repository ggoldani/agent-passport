import { paymentMiddlewareFromConfig } from "@x402/express"
import { HTTPFacilitatorClient } from "@x402/core/server"
import { ExactStellarScheme } from "@x402/stellar/exact/server"

export const ANALYZE_ACCOUNT_ROUTE_PATH = "/analyze-account"

export interface X402ProviderConfigEnv {
  STELLAR_NETWORK_PASSPHRASE?: string
  X402_FACILITATOR_URL?: string
  PROVIDER_PRICE_XLM?: string
  X402_PAY_TO?: string
}

export interface X402ProtectedRouteConfig {
  accepts: {
    scheme: "exact"
    price: string
    network: "stellar:testnet" | "stellar:pubnet"
    payTo: string
  }
  description: string
}

export interface X402ProviderConfig {
  facilitatorUrl: string
  network: "stellar:testnet" | "stellar:pubnet"
  protectedRoutePath: typeof ANALYZE_ACCOUNT_ROUTE_PATH
  middlewareConfig: Record<`POST ${typeof ANALYZE_ACCOUNT_ROUTE_PATH}`, X402ProtectedRouteConfig>
}

interface NodeLikeIncoming {
  headers: Record<string, string | string[] | undefined>
  method?: string
  url?: string
  socket?: unknown
  header?: (name: string) => string | string[] | undefined
  path?: string
  protocol?: string
  originalUrl?: string
  query?: Record<string, string | string[]>
}

interface NodeLikeOutgoing {
  statusCode: number
  setHeader(name: string, value: string): this
  end(chunk?: string | Uint8Array): this
  status?: (statusCode: number) => NodeLikeOutgoing
  json?: (body: unknown) => NodeLikeOutgoing
  send?: (body: unknown) => NodeLikeOutgoing
}

const TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
const PUBNET_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015"

function readRequiredEnvVar(
  env: X402ProviderConfigEnv,
  key: keyof X402ProviderConfigEnv,
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

function normalizeAbsoluteUrl(urlValue: string, envKey: string): string {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(urlValue)
  } catch {
    throw new Error(
      `Invalid ${envKey}: expected an absolute URL, got ${JSON.stringify(urlValue)}`,
    )
  }

  return parsedUrl.toString()
}

function normalizeStellarAddress(address: string): string {
  const normalized = address.trim()

  if (!/^G[A-Z2-7]{55}$/.test(normalized)) {
    throw new Error(
      `Invalid X402_PAY_TO: expected a Stellar public key, got ${JSON.stringify(address)}`,
    )
  }

  return normalized
}

function normalizePrice(price: string): string {
  const normalized = price.trim()

  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) {
    throw new Error(
      `Invalid PROVIDER_PRICE_XLM: expected a positive decimal string, got ${JSON.stringify(price)}`,
    )
  }

  if (Number.parseFloat(normalized) <= 0) {
    throw new Error(
      `Invalid PROVIDER_PRICE_XLM: expected a value greater than zero, got ${JSON.stringify(price)}`,
    )
  }

  return normalized
}

export function resolveX402Network(
  networkPassphrase: string,
): "stellar:testnet" | "stellar:pubnet" {
  const normalizedPassphrase = networkPassphrase.trim()

  if (normalizedPassphrase === TESTNET_NETWORK_PASSPHRASE) {
    return "stellar:testnet"
  }

  if (normalizedPassphrase === PUBNET_NETWORK_PASSPHRASE) {
    return "stellar:pubnet"
  }

  throw new Error(
    `Unsupported STELLAR_NETWORK_PASSPHRASE for x402 provider config: ${JSON.stringify(networkPassphrase)}`,
  )
}

export function loadX402ProviderConfig(env: X402ProviderConfigEnv): X402ProviderConfig {
  const network = resolveX402Network(
    readRequiredEnvVar(env, "STELLAR_NETWORK_PASSPHRASE"),
  )
  const facilitatorUrl = normalizeAbsoluteUrl(
    readRequiredEnvVar(env, "X402_FACILITATOR_URL"),
    "X402_FACILITATOR_URL",
  )
  const price = normalizePrice(readRequiredEnvVar(env, "PROVIDER_PRICE_XLM"))
  const payTo = normalizeStellarAddress(readRequiredEnvVar(env, "X402_PAY_TO"))

  return {
    facilitatorUrl,
    network,
    protectedRoutePath: ANALYZE_ACCOUNT_ROUTE_PATH,
    middlewareConfig: {
      [`POST ${ANALYZE_ACCOUNT_ROUTE_PATH}`]: {
        accepts: {
          scheme: "exact",
          price,
          network,
          payTo,
        },
        description: "Analyze a Stellar account with StellarIntel",
      },
    },
  }
}

function decorateNodeRequestForX402(incoming: NodeLikeIncoming): NodeLikeIncoming {
  const host = incoming.headers.host
  const normalizedHost = Array.isArray(host) ? host[0] : host
  const protocol =
    typeof incoming.socket === "object" &&
    incoming.socket !== null &&
    "encrypted" in incoming.socket &&
    incoming.socket.encrypted === true
      ? "https"
      : "http"
  const originalUrl = incoming.url ?? "/"
  const requestUrl = new URL(originalUrl, `${protocol}://${normalizedHost ?? "localhost"}`)

  incoming.header = (name: string) => {
    const value = incoming.headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }
  incoming.path = requestUrl.pathname
  incoming.protocol = requestUrl.protocol.replace(/:$/, "")
  incoming.originalUrl = originalUrl
  incoming.query = Object.fromEntries(requestUrl.searchParams.entries())

  return incoming
}

function decorateNodeResponseForX402(outgoing: NodeLikeOutgoing): NodeLikeOutgoing {
  outgoing.status = (statusCode: number) => {
    outgoing.statusCode = statusCode
    return outgoing
  }
  outgoing.json = (body: unknown) => {
    outgoing.setHeader("content-type", "application/json")
    outgoing.end(JSON.stringify(body))
    return outgoing
  }
  outgoing.send = (body: unknown) => {
    if (typeof body === "string") {
      outgoing.end(body)
      return outgoing
    }

    if (body instanceof Uint8Array) {
      outgoing.end(body)
      return outgoing
    }

    return outgoing.json?.(body) ?? outgoing
  }

  return outgoing
}

export function createX402NodeMiddleware(env: X402ProviderConfigEnv) {
  const providerConfig = loadX402ProviderConfig(env)
  const middleware = paymentMiddlewareFromConfig(
    providerConfig.middlewareConfig,
    new HTTPFacilitatorClient({ url: providerConfig.facilitatorUrl }),
    [{ network: providerConfig.network, server: new ExactStellarScheme() }],
  )

  return async (
    incoming: NodeLikeIncoming,
    outgoing: NodeLikeOutgoing,
    next: (error?: unknown) => Promise<void> | void,
  ): Promise<void> => {
    const request = decorateNodeRequestForX402(incoming)
    const response = decorateNodeResponseForX402(outgoing)

    await middleware(request as never, response as never, next as never)
  }
}
