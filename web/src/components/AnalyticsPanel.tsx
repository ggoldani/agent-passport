"use client"

import { useState } from "react"
import { PeriodSelector } from "./analytics/PeriodSelector"
import { VolumeChart } from "./analytics/VolumeChart"
import { CounterpartyChart } from "./analytics/CounterpartyChart"
import { ScoreChart } from "./analytics/ScoreChart"
import { RatingBreakdown } from "./analytics/RatingBreakdown"
import type { ApiAnalyticsResponse } from "../lib/api-types"

interface AnalyticsPanelProps {
  agentName: string
  initialStats: ApiAnalyticsResponse | null
  address: string
}

const PERIODS = ["7d", "30d", "90d", "all"]

export function AnalyticsPanel({ agentName, initialStats, address }: AnalyticsPanelProps) {
  const [period, setPeriod] = useState("30d")
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(false)

  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod)
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/agents/${address}/stats?period=${newPeriod}`)
      const data = await res.json()
      setStats(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  if (!stats) {
    return (
      <section className="panel">
        <p className="eyebrow">Analytics</p>
        <h2 className="section-title">{agentName}</h2>
        <p style={{ color: "var(--text-tertiary)" }}>No analytics data available</p>
      </section>
    )
  }

  return (
    <section className="stack-md">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <p className="eyebrow">Analytics</p>
          <h2 className="section-title">{agentName}</h2>
        </div>
        <PeriodSelector periods={PERIODS} value={period} onChange={handlePeriodChange} />
      </div>

      {loading && <div style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>Loading...</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        <section className="panel">
          <p className="eyebrow">Volume Over Time</p>
          <VolumeChart data={stats.volume_over_time} />
        </section>
        <section className="panel">
          <p className="eyebrow">Counterparty Growth</p>
          <CounterpartyChart data={stats.counterparty_growth} />
        </section>
        <section className="panel">
          <p className="eyebrow">Score Trajectory</p>
          <ScoreChart data={stats.score_trajectory} />
        </section>
        <section className="panel">
          <p className="eyebrow">Rating Breakdown</p>
          <RatingBreakdown data={stats.rating_breakdown} />
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Summary</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", fontSize: "13px" }}>
          <div><span style={{ color: "var(--text-tertiary)" }}>Total Volume</span><br /><strong>{stats.summary.total_volume}</strong></div>
          <div><span style={{ color: "var(--text-tertiary)" }}>Interactions</span><br /><strong>{stats.summary.total_interactions}</strong></div>
          <div><span style={{ color: "var(--text-tertiary)" }}>Counterparties</span><br /><strong>{stats.summary.unique_counterparties}</strong></div>
          <div><span style={{ color: "var(--text-tertiary)" }}>Avg Rating</span><br /><strong>{stats.summary.avg_rating} / 5</strong></div>
        </div>
      </section>
    </section>
  )
}
