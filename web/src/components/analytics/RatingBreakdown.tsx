"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface RatingBreakdownProps {
  data: Record<string, { avg: number; count: number }>
}

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444"]

export function RatingBreakdown({ data }: RatingBreakdownProps) {
  const entries = Object.entries(data).filter(([_, v]) => v.count > 0)
  if (entries.length === 0) {
    return <div style={{ padding: "20px", color: "var(--text-tertiary)" }}>No rating data available</div>
  }

  const chartData = entries.map(([dimension, v]) => ({
    dimension: dimension.charAt(0).toUpperCase() + dimension.slice(1),
    avg: Math.round(v.avg * 10) / 10,
    count: v.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <XAxis dataKey="dimension" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <Tooltip
          contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--text-tertiary)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: unknown, _name: unknown, props: any) => [`${value ?? 0} (${props.payload.count} ratings)`, "Average"] as const}
        />
        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
