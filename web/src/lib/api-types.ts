export interface ApiAnalyticsResponse {
  address: string
  period: string
  volume_over_time: Array<{ date: string; volume: string }>
  counterparty_growth: Array<{ date: string; unique_counterparties: number }>
  score_trajectory: Array<{ date: string; score: number }>
  rating_breakdown: Record<string, { avg: number; count: number }>
  summary: {
    total_volume: string
    total_interactions: number
    unique_counterparties: number
    avg_rating: number
  }
}
