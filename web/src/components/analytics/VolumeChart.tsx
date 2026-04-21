"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { formatXlmAmount } from "../../lib/format"

interface VolumeChartProps {
  data: Array<{ date: string; volume: string }>
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (data.length === 0) {
    return <div style={{ padding: "20px", color: "var(--text-tertiary)" }}>No volume data for this period</div>
  }

  const xlmData = data.map(d => ({ date: d.date, volume: Number(Number(d.volume) / 1e7) }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={xlmData}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <Tooltip
          contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--text-tertiary)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: unknown) => [`${Number(value).toFixed(2)} XLM`, "Volume"]}
        />
        <Area type="monotone" dataKey="volume" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
