declare const process: {
  env: Record<string, string | undefined>
}

import { StrKey } from "@stellar/stellar-sdk"
import { Hono } from "hono"

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

function countTrustlinesFromBalances(
  balances: Array<{ asset_type: string }>,
): number {
  return balances.filter((balance) => balance.asset_type !== "native").length
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

  const stellarMcpClient = StellarMcpClient.fromEnv(process.env)

  try {
    const [account, history] = await Promise.all([
      stellarMcpClient.getAccount(address),
      stellarMcpClient.getAccountHistory(address, {
        limit: 5,
        includeOperations: true,
      }),
    ])

    return context.json(
      {
        ok: true,
        code: "companion_data_loaded",
        address,
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
        companionData: {
          account: {
            accountId: account.accountId,
            balanceCount: account.balances.length,
            trustlineCount: countTrustlinesFromBalances(account.balances),
            signerCount: account.signers.length,
            minimumBalance: account.minimumBalance,
          },
          history: {
            recordCount: history.records.length,
            latestTransactionHash: history.records[0]?.hash ?? null,
            latestTransactionAt: history.records[0]?.createdAt ?? null,
          },
        },
      },
      200,
    )
  } catch {
    return context.json(
      {
        ok: false,
        code: "stellar_mcp_unavailable",
      },
      502,
    )
  } finally {
    await stellarMcpClient.close()
  }
})
