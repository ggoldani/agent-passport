import { Hono } from "hono"

import { readX402VerifiedPaymentContext } from "../lib/x402"

export const analyzeAccountRoute = new Hono()

analyzeAccountRoute.post("/", (context) => {
  const verifiedPayment = readX402VerifiedPaymentContext((name) => context.req.header(name))

  if (verifiedPayment === null) {
    return context.json(
      {
        ok: false,
        code: "payment_context_missing",
      },
      500,
    )
  }

  const { accepted, payload, x402Version } = verifiedPayment.paymentPayload

  return context.json(
    {
      ok: true,
      code: "paid_request_verified",
      payment: {
        x402Version,
        network: accepted.network,
        amount: accepted.amount,
        asset: accepted.asset,
        payTo: accepted.payTo,
        hasTransactionPayload:
          typeof payload === "object" &&
          payload !== null &&
          typeof payload.transaction === "string",
      },
    },
    200,
  )
})
