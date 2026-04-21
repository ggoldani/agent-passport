"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface ScoreChartProps {
  data: Array<{ date: string; score: number }>
}

export function ScoreChart({ data }: ScoreChartProps) {
  if (data.length === 0) {
    return <div style={{ padding: "20px", color: "var(--text-tertiary)" }}>No score data for this period</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <Tooltip
          contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--text-tertiary)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: unknown) => [String(value ?? 0), "Score"]}
        />
        <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
