"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface RatingBreakdownProps {
  data: Record<string, { avg: number; count: number }>
}

const COLORS = ["#F59E0B", "#8B5CF6", "#22C55E", "#3B82F6"]

export function RatingBreakdown({ data }: RatingBreakdownProps) {
  const entries = Object.entries(data).filter(([_, v]) => v.count > 0)
  if (entries.length === 0) {
    return <div className="p-5 text-muted-foreground">No rating data available</div>
  }

  const chartData = entries.map(([dimension, v]) => ({
    dimension: dimension.charAt(0).toUpperCase() + dimension.slice(1),
    avg: Math.round(v.avg * 10) / 10,
    count: v.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <XAxis dataKey="dimension" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
        <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
        <Tooltip
          contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--color-foreground)" }}
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
