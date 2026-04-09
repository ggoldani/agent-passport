import { StrKey } from "@stellar/stellar-sdk"
import { Hono } from "hono"

import { readX402VerifiedPaymentContext } from "../lib/x402"

export const analyzeAccountRoute = new Hono()

interface AnalyzeAccountRequestBody {
  address: string
}

function isAnalyzeAccountRequestBody(value: unknown): value is AnalyzeAccountRequestBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "address" in value &&
    typeof value.address === "string"
  )
}

analyzeAccountRoute.post("/", async (context) => {
  let requestBody: unknown

  try {
    requestBody = await context.req.json()
  } catch {
    return context.json(
      {
        ok: false,
        code: "invalid_json",
      },
      400,
    )
  }

  if (!isAnalyzeAccountRequestBody(requestBody)) {
    return context.json(
      {
        ok: false,
        code: "invalid_address",
      },
      400,
    )
  }

  const address = requestBody.address.trim()

  if (!StrKey.isValidEd25519PublicKey(address)) {
    return context.json(
      {
        ok: false,
        code: "invalid_address",
      },
      400,
    )
  }

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
