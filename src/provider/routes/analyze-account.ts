import { Hono } from "hono"

export const analyzeAccountRoute = new Hono()

analyzeAccountRoute.post("/", (context) => {
  return context.json(
    {
      ok: false,
      code: "not_implemented",
      message: "analyze-account route not implemented yet",
    },
    501,
  )
})
