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
}

export interface X402ProviderConfig {
  facilitatorUrl: string
  network: "stellar:testnet" | "stellar:pubnet"
  protectedRoutePath: typeof ANALYZE_ACCOUNT_ROUTE_PATH
  middlewareConfig: Record<`POST ${typeof ANALYZE_ACCOUNT_ROUTE_PATH}`, X402ProtectedRouteConfig>
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
      },
    },
  }
}
