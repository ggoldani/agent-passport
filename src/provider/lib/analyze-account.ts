import type {
  StellarMcpAccount,
  StellarMcpAccountHistory,
  StellarMcpAccountHistoryRecord,
} from "./stellar-mcp-client.js"

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

function selectLatestTransactionAt(
  records: StellarMcpAccountHistoryRecord[],
): string | null {
  let latestTimestampMs = Number.NEGATIVE_INFINITY
  let latestCreatedAt: string | null = null

  for (const record of records) {
    const timestampMs = Date.parse(record.createdAt)

    if (!Number.isNaN(timestampMs) && timestampMs > latestTimestampMs) {
      latestTimestampMs = timestampMs
      latestCreatedAt = record.createdAt
    }
  }

  return latestCreatedAt
}

function buildRecentActivityFromHistory(
  history: StellarMcpAccountHistory,
): AccountAnalysisRecentActivity {
  return {
    transactionCount: history.records.length,
    paymentCount: history.records.reduce((count, record) => {
      return count + record.operations.filter((operation) => operation.type === "payment").length
    }, 0),
    latestTransactionAt: selectLatestTransactionAt(history.records),
  }
}

export function addRecentActivityFromHistory(
  analysis: AccountAnalysis,
  history: StellarMcpAccountHistory,
): AccountAnalysis {
  return {
    ...analysis,
    recentActivity: buildRecentActivityFromHistory(history),
  }
}

function hasPositiveNativeBalance(analysis: AccountAnalysis): boolean {
  return analysis.balances.some((balance) => {
    return balance.assetType === "native" && Number.parseFloat(balance.amount) > 0
  })
}

function hasPositiveTrustlineBalance(analysis: AccountAnalysis): boolean {
  return analysis.trustlines.some((trustline) => {
    return Number.parseFloat(trustline.amount) > 0
  })
}

function buildDeterministicSignals(
  analysis: AccountAnalysis,
): AccountAnalysisSignal[] {
  const signals: AccountAnalysisSignal[] = []

  if (analysis.recentActivity.transactionCount >= 3) {
    signals.push({
      code: "active_recent_history",
      label: "Active in recent history",
    })
  } else if (analysis.recentActivity.transactionCount === 0) {
    signals.push({
      code: "low_recent_activity",
      label: "Low recent activity",
    })
  }

  if (analysis.recentActivity.paymentCount > 0) {
    signals.push({
      code: "recent_payment_activity",
      label: "Shows recent payment activity",
    })
  }

  if (hasPositiveNativeBalance(analysis) && hasPositiveTrustlineBalance(analysis)) {
    signals.push({
      code: "mixed_asset_usage",
      label: "Uses mixed native and non-native assets",
    })
  }

  return signals
}

export function addDeterministicSignals(
  analysis: AccountAnalysis,
): AccountAnalysis {
  return {
    ...analysis,
    signals: buildDeterministicSignals(analysis),
  }
}
