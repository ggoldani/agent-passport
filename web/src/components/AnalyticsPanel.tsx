"use client"

import { useState } from "react"
import { PeriodSelector } from "./analytics/PeriodSelector"
import { VolumeChart } from "./analytics/VolumeChart"
import { CounterpartyChart } from "./analytics/CounterpartyChart"
import { ScoreChart } from "./analytics/ScoreChart"
import { RatingBreakdown } from "./analytics/RatingBreakdown"
import type { ApiAnalyticsResponse } from "../lib/api-types"
import { formatXlmAmount } from "../lib/format"

interface AnalyticsPanelProps {
  agentName: string
  initialStats: ApiAnalyticsResponse | null
  address: string
}

const PERIODS = ["7d", "30d", "90d", "all"]

function isValidStats(data: unknown): data is ApiAnalyticsResponse {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return typeof d.address === "string" && Array.isArray(d.volume_over_time)
}

export function AnalyticsPanel({ agentName, initialStats, address }: AnalyticsPanelProps) {
  const [period, setPeriod] = useState("30d")
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePeriodChange = async (newPeriod: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(address)}/stats?period=${newPeriod}`)
      if (!res.ok) {
        setError(`Request failed (${res.status})`)
        return
      }
      const data: unknown = await res.json()
      if (!isValidStats(data)) {
        setError("Invalid response from API")
        return
      }
      setPeriod(newPeriod)
      setStats(data)
    } catch {
      setError("Network error — check your connection")
    } finally {
      setLoading(false)
    }
  }

  if (!stats) {
    return (
      <section className="panel">
        <p className="eyebrow">Analytics</p>
        <h2 className="section-title">{agentName}</h2>
        <p style={{ color: "var(--muted)" }}>No analytics data available</p>
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

      {loading && <div style={{ color: "var(--muted)", fontSize: "12px" }}>Loading...</div>}
      {error && <div style={{ color: "var(--text-error, #e74c3c)", fontSize: "12px" }}>{error}</div>}

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
          <div><span style={{ color: "var(--muted)" }}>Total Volume</span><br /><strong>{formatXlmAmount(stats.summary.total_volume)}</strong></div>
          <div><span style={{ color: "var(--muted)" }}>Interactions</span><br /><strong>{stats.summary.total_interactions}</strong></div>
          <div><span style={{ color: "var(--muted)" }}>Counterparties</span><br /><strong>{stats.summary.unique_counterparties}</strong></div>
          <div><span style={{ color: "var(--muted)" }}>Avg Rating</span><br /><strong>{stats.summary.avg_rating.toFixed(1)} / 5</strong></div>
        </div>
      </section>
    </section>
  )
}
