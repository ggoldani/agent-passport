import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/express"
import {
  decodePaymentResponseHeader,
  decodePaymentSignatureHeader,
} from "@x402/core/http"
import type {
  HTTPRequestContext,
  ProcessSettleFailureResponse,
} from "@x402/core/http"
import { HTTPFacilitatorClient } from "@x402/core/server"
import type { PaymentPayload, SettleResponse } from "@x402/core/types"
import { Asset } from "@stellar/stellar-sdk"
import {
  convertToTokenAmount,
  getNetworkPassphrase,
} from "@x402/stellar"
import { ExactStellarScheme } from "@x402/stellar/exact/server"
import {
  createProviderWorkerHandshakeInput,
  runProviderWorkerHandshake,
  type ProviderWorkerHandshakeInput,
} from "./worker-handshake"

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
  settlementFailedResponseBody?: (
    context: HTTPRequestContext,
    settleResult: Omit<ProcessSettleFailureResponse, "response">,
  ) => Promise<{
    contentType: string
    body: ProviderSettlementFailureBody
  }>
}

export interface X402ProviderConfig {
  facilitatorUrl: string
  network: "stellar:testnet" | "stellar:pubnet"
  protectedRoutePath: typeof ANALYZE_ACCOUNT_ROUTE_PATH
  middlewareConfig: Record<`POST ${typeof ANALYZE_ACCOUNT_ROUTE_PATH}`, X402ProtectedRouteConfig>
}

export interface ProviderSettlementFailureBody {
  ok: false
  code:
    | "worker_handoff_failed"
    | "payment_context_invalid"
    | "payment_settlement_failed"
  errorReason: string
}

export interface X402VerifiedPaymentContext {
  rawHeader: string
  paymentPayload: PaymentPayload
}

export interface X402SettlementContext {
  rawHeader: string
  settleResponse: SettleResponse
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
const STELLAR_INTEL_SERVICE_LABEL = "stellar-intel"

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

function buildNativeXlmAsset(network: "stellar:testnet" | "stellar:pubnet") {
  return Asset.native().contractId(getNetworkPassphrase(network))
}

function createExactStellarServerScheme(
  network: "stellar:testnet" | "stellar:pubnet",
): ExactStellarScheme {
  return new ExactStellarScheme().registerMoneyParser(async (amount, parserNetwork) => {
    if (parserNetwork !== network) {
      return null
    }

    return {
      amount: convertToTokenAmount(String(amount)),
      asset: buildNativeXlmAsset(network),
      extra: {},
    }
  })
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
        settlementFailedResponseBody: async (_context, settleResult) => ({
          contentType: "application/json",
          body: buildProviderSettlementFailureBody(settleResult.errorReason),
        }),
      },
    },
  }
}

export function buildProviderSettlementFailureBody(
  errorReason: string,
): ProviderSettlementFailureBody {
  if (errorReason.startsWith("Worker handoff failed:")) {
    return {
      ok: false,
      code: "worker_handoff_failed",
      errorReason,
    }
  }

  if (errorReason.startsWith("Expected settled payment")) {
    return {
      ok: false,
      code: "payment_context_invalid",
      errorReason,
    }
  }

  return {
    ok: false,
    code: "payment_settlement_failed",
    errorReason,
  }
}

export function readX402VerifiedPaymentContext(
  getHeader: (name: string) => string | undefined,
): X402VerifiedPaymentContext | null {
  const rawHeader = getHeader("payment-signature") ?? getHeader("x-payment")

  if (rawHeader === undefined) {
    return null
  }

  return {
    rawHeader,
    paymentPayload: decodePaymentSignatureHeader(rawHeader),
  }
}

export function readX402SettlementContext(
  getHeader: (name: string) => string | undefined,
): X402SettlementContext | null {
  const rawHeader = getHeader("payment-response")

  if (rawHeader === undefined) {
    return null
  }

  return {
    rawHeader,
    settleResponse: decodePaymentResponseHeader(rawHeader),
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

function requireSettlementString(
  value: string | undefined,
  fieldName: "payer" | "transaction" | "amount",
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected settled payment ${fieldName} to be a non-empty string`)
  }

  return value.trim()
}

export interface ProviderSettlementHookContext {
  requirements: {
    payTo: string
    amount: string
    asset: string
  }
  result: {
    payer?: string
    transaction: string
    amount?: string
  }
}

export type ProviderWorkerInvoker = (
  input: ProviderWorkerHandshakeInput,
) => Promise<Awaited<ReturnType<typeof runProviderWorkerHandshake>>>

export async function handleProviderSettlementResult(
  context: ProviderSettlementHookContext,
  invokeWorker: ProviderWorkerInvoker = runProviderWorkerHandshake,
): Promise<Awaited<ReturnType<typeof runProviderWorkerHandshake>>> {
  const handoff = createProviderWorkerHandshakeInput({
    providerAddress: context.requirements.payTo,
    consumerAddress: requireSettlementString(context.result.payer, "payer"),
    txHash: requireSettlementString(context.result.transaction, "transaction"),
    amount:
      context.result.amount === undefined
        ? context.requirements.amount
        : requireSettlementString(context.result.amount, "amount"),
    asset: context.requirements.asset,
    occurredAt: new Date().toISOString(),
    serviceLabel: STELLAR_INTEL_SERVICE_LABEL,
  })
  const result = await invokeWorker(handoff)

  if (result.ok === false) {
    throw new Error(`Worker handoff failed: ${result.error.code}`)
  }

  return result
}

export function createX402NodeMiddleware(env: X402ProviderConfigEnv) {
  const providerConfig = loadX402ProviderConfig(env)
  const resourceServer = new x402ResourceServer(
    new HTTPFacilitatorClient({ url: providerConfig.facilitatorUrl }),
  )
    .register(
      providerConfig.network,
      createExactStellarServerScheme(providerConfig.network),
    )
    .onAfterSettle(async (context) => {
      await handleProviderSettlementResult(context)
    })
  const httpServer = new x402HTTPResourceServer(
    resourceServer,
    providerConfig.middlewareConfig,
  )
  const middleware = paymentMiddlewareFromHTTPServer(httpServer)

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
