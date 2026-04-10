export interface RelayerConfig {
  networkPassphrase: string
  rpcUrl: string
  contractId: string
  relayerSecretKey: string
}

export interface RelayerConfigEnv {
  STELLAR_NETWORK_PASSPHRASE?: string
  STELLAR_RPC_URL?: string
  CONTRACT_ID?: string
  RELAYER_SECRET_KEY?: string
}

const RELAYER_ENV_KEYS = {
  networkPassphrase: "STELLAR_NETWORK_PASSPHRASE",
  rpcUrl: "STELLAR_RPC_URL",
  contractId: "CONTRACT_ID",
  relayerSecretKey: "RELAYER_SECRET_KEY",
} as const

function readRequiredEnvVar(
  env: RelayerConfigEnv,
  key: keyof RelayerConfigEnv,
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

function normalizeRelayerRpcUrl(rpcUrl: string): string {
  let normalizedUrl: URL

  try {
    normalizedUrl = new URL(rpcUrl)
  } catch {
    throw new Error(
      `Invalid ${RELAYER_ENV_KEYS.rpcUrl}: expected an absolute URL, got ${JSON.stringify(rpcUrl)}`,
    )
  }

  return normalizedUrl.toString()
}

export function loadRelayerConfig(env: RelayerConfigEnv): RelayerConfig {
  const networkPassphrase = readRequiredEnvVar(
    env,
    "STELLAR_NETWORK_PASSPHRASE",
  )
  const rpcUrl = normalizeRelayerRpcUrl(
    readRequiredEnvVar(env, "STELLAR_RPC_URL"),
  )
  const contractId = readRequiredEnvVar(env, "CONTRACT_ID")
  const relayerSecretKey = readRequiredEnvVar(env, "RELAYER_SECRET_KEY")

  return {
    networkPassphrase,
    rpcUrl,
    contractId,
    relayerSecretKey,
  }
}
