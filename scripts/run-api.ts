import { applyEnvFile } from "../src/lib/env.js"
import { createApiServer } from "../src/api/server.js"
import { serve } from "@hono/node-server"

applyEnvFile()

const port = Number(process.env.API_PORT ?? 3002)
const app = createApiServer()

serve({ fetch: app.fetch, port })
console.log(`AgentPassport API running on http://localhost:${port}`)
