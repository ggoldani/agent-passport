declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
}

import { createServer } from "node:http"
import { getRequestListener } from "@hono/node-server"
import { Hono } from "hono"

import { createX402NodeMiddleware } from "./lib/x402"
import { analyzeAccountRoute } from "./routes/analyze-account"

const DEFAULT_PROVIDER_PORT = 3001

export const providerApp = new Hono()

function buildHealthResponse() {
  return {
    ok: true,
    service: "stellar-intel-provider",
  }
}

providerApp.get("/", (context) => {
  return context.json(buildHealthResponse())
})

providerApp.get("/health", (context) => {
  return context.json(buildHealthResponse())
})

providerApp.route("/analyze-account", analyzeAccountRoute)

export function resolveProviderPort(env: Record<string, string | undefined>): number {
  const configuredPort = env.PROVIDER_PORT?.trim()

  if (configuredPort === undefined || configuredPort.length === 0) {
    return DEFAULT_PROVIDER_PORT
  }

  const parsedPort = Number.parseInt(configuredPort, 10)
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid PROVIDER_PORT: expected a positive integer, got ${JSON.stringify(configuredPort)}`)
  }

  return parsedPort
}

export function startProviderServer(port = resolveProviderPort(process.env)) {
  const honoListener = getRequestListener(providerApp.fetch)
  const x402Middleware = createX402NodeMiddleware(process.env)

  const server = createServer(async (incoming, outgoing) => {
    await x402Middleware(incoming, outgoing, async (error?: unknown) => {
      if (error !== undefined) {
        outgoing.statusCode = 500
        outgoing.setHeader("content-type", "application/json")
        outgoing.end(JSON.stringify({ ok: false, code: "provider_error" }))
        return
      }

      await honoListener(incoming, outgoing)
    })
  })

  server.listen(port)
  return server
}

if (process.argv[1]?.endsWith("src/provider/server.ts")) {
  startProviderServer()
}
