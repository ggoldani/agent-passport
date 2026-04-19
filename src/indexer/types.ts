export interface IndexerConfig {
  contractId: string
  rpcUrl: string
  dbPath?: string
  pollIntervalMs?: number
}

export interface IndexerStats {
  currentLedger: number
  watermarkLedger: number
  agentsCount: number
  interactionsCount: number
  ratingsCount: number
  lastPollAt: number
}
