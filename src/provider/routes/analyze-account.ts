declare const process: {
  env: Record<string, string | undefined>
}

import { StrKey } from "@stellar/stellar-sdk"
import { Hono } from "hono"

import {
  addDeterministicSignals,
  addRecentActivityFromHistory,
  buildAccountAnalysisFromAccount,
} from "../lib/analyze-account"
import { generateAccountSummary } from "../lib/summary"
import { readX402VerifiedPaymentContext } from "../lib/x402"
import { StellarMcpClient } from "../lib/stellar-mcp-client"

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

  try {
    const stellarMcpClient = StellarMcpClient.fromEnv(process.env)
    try {
      const [account, history] = await Promise.all([
        stellarMcpClient.getAccount(address),
        stellarMcpClient.getAccountHistory(address, {
          limit: 5,
          includeOperations: true,
        }),
      ])
      const analysis = addDeterministicSignals(
        addRecentActivityFromHistory(
          buildAccountAnalysisFromAccount(address, account),
          history,
        ),
      )

      return context.json(
        {
          ok: true,
          code: "account_analysis_ready",
          address,
          summary: generateAccountSummary(analysis),
          balances: analysis.balances,
          trustlines: analysis.trustlines,
          recentActivity: analysis.recentActivity,
          signals: analysis.signals.map((signal) => signal.label),
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
    } finally {
      await stellarMcpClient.close()
    }
  } catch {
    return context.json(
      {
        ok: false,
        code: "stellar_mcp_unavailable",
      },
      502,
    )
  }
})
