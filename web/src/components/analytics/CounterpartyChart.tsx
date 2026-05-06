"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface CounterpartyChartProps {
  data: Array<{ date: string; unique_counterparties: number }>
}

export function CounterpartyChart({ data }: CounterpartyChartProps) {
  if (data.length === 0) {
    return <div className="p-5 text-muted-foreground">No counterparty data for this period</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
        <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted)" />
        <Tooltip
          contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-muted)", borderRadius: "4px", fontSize: "12px" }}
          labelStyle={{ color: "var(--color-foreground)" }}
          formatter={(value: unknown) => [String(value ?? 0), "Counterparties"]}
        />
        <Line type="monotone" dataKey="unique_counterparties" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
