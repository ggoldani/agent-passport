declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
}

import { serve } from "@hono/node-server"
import { Hono } from "hono"

const DEFAULT_PROVIDER_PORT = 3001

export const providerApp = new Hono()

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
  return serve({
    fetch: providerApp.fetch,
    port,
  })
}

if (process.argv[1]?.endsWith("src/provider/server.ts")) {
  startProviderServer()
}
