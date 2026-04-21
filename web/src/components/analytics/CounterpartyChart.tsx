"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface CounterpartyChartProps {
  data: Array<{ date: string; unique_counterparties: number }>
}

export function CounterpartyChart({ data }: CounterpartyChartProps) {
  if (data.length === 0) {
    return <div style={{ padding: "20px", color: "var(--text-tertiary)" }}>No counterparty data for this period</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--text-tertiary)" />
        <Tooltip
          contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--text-tertiary)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: unknown) => [String(value ?? 0), "Counterparties"]}
        />
        <Line type="monotone" dataKey="unique_counterparties" stroke="var(--accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
