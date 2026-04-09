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
