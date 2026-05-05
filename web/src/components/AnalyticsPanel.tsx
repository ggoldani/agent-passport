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
      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Analytics</p>
        <h2 className="font-heading text-2xl leading-tight text-foreground">{agentName}</h2>
        <p className="mt-2 text-muted">No analytics data available</p>
      </section>
    )
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Analytics</p>
          <h2 className="font-heading text-2xl leading-tight text-foreground">{agentName}</h2>
        </div>
        <PeriodSelector periods={PERIODS} value={period} onChange={handlePeriodChange} />
      </div>

      {loading && <div className="text-xs text-muted">Loading...</div>}
      {error && <div className="text-xs text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Volume Over Time</p>
          <VolumeChart data={stats.volume_over_time} />
        </section>
        <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Counterparty Growth</p>
          <CounterpartyChart data={stats.counterparty_growth} />
        </section>
        <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Score Trajectory</p>
          <ScoreChart data={stats.score_trajectory} />
        </section>
        <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Rating Breakdown</p>
          <RatingBreakdown data={stats.rating_breakdown} />
        </section>
      </div>

      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Summary</p>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <span className="text-muted">Total Volume</span>
            <br />
            <strong className="text-foreground">{formatXlmAmount(stats.summary.total_volume)}</strong>
          </div>
          <div>
            <span className="text-muted">Interactions</span>
            <br />
            <strong className="text-foreground">{stats.summary.total_interactions}</strong>
          </div>
          <div>
            <span className="text-muted">Counterparties</span>
            <br />
            <strong className="text-foreground">{stats.summary.unique_counterparties}</strong>
          </div>
          <div>
            <span className="text-muted">Avg Rating</span>
            <br />
            <strong className="text-foreground">{stats.summary.avg_rating.toFixed(1)} / 5</strong>
          </div>
        </div>
      </section>
    </section>
  )
}
