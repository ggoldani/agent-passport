import { Hono } from "hono"

const app = new Hono()
app.get("/", (c) => c.json({ status: "ok", service: "agent-passport-api" }))
app.get("/health", (c) => c.json({ status: "ok", service: "agent-passport-api" }))

export default app
