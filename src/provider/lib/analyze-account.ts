import type { StellarMcpAccount } from "./stellar-mcp-client.js"

export type StellarAssetType =
  | "native"
  | "credit_alphanum4"
  | "credit_alphanum12"

export interface AccountAnalysisBalance {
  asset: string
  amount: string
  assetType: StellarAssetType
  issuer: string | null
}

export interface AccountAnalysisTrustline {
  asset: string
  issuer: string
  amount: string
}

export interface AccountAnalysisRecentActivity {
  transactionCount: number
  paymentCount: number
  latestTransactionAt: string | null
}

export interface AccountAnalysisSignal {
  code: string
  label: string
}

export interface AccountAnalysis {
  address: string
  balances: AccountAnalysisBalance[]
  trustlines: AccountAnalysisTrustline[]
  recentActivity: AccountAnalysisRecentActivity
  signals: AccountAnalysisSignal[]
}

export function createEmptyAccountAnalysis(address: string): AccountAnalysis {
  return {
    address,
    balances: [],
    trustlines: [],
    recentActivity: {
      transactionCount: 0,
      paymentCount: 0,
      latestTransactionAt: null,
    },
    signals: [],
  }
}

function normalizeAssetType(assetType: string): StellarAssetType {
  if (
    assetType === "native" ||
    assetType === "credit_alphanum4" ||
    assetType === "credit_alphanum12"
  ) {
    return assetType
  }

  throw new Error(`Unsupported Stellar asset type: ${assetType}`)
}

function formatAssetLabel(balance: {
  asset_type: string
  asset_code?: string
}): string {
  if (balance.asset_type === "native") {
    return "XLM"
  }

  return balance.asset_code ?? "UNKNOWN"
}

function requireIssuer(balance: {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
}): string {
  if (balance.asset_issuer !== undefined) {
    return balance.asset_issuer
  }

  throw new Error(
    `Missing issuer for trustline asset: ${formatAssetLabel(balance)}`,
  )
}

export function buildAccountAnalysisFromAccount(
  address: string,
  account: StellarMcpAccount,
): AccountAnalysis {
  const analysis = createEmptyAccountAnalysis(address)

  analysis.balances = account.balances.map((balance) => ({
    asset: formatAssetLabel(balance),
    amount: balance.balance,
    assetType: normalizeAssetType(balance.asset_type),
    issuer: balance.asset_issuer ?? null,
  }))

  analysis.trustlines = account.balances
    .filter((balance) => balance.asset_type !== "native")
    .map((balance) => ({
      asset: formatAssetLabel(balance),
      issuer: requireIssuer(balance),
      amount: balance.balance,
    }))

  return analysis
}
