"use client"

interface PeriodSelectorProps {
  periods: string[]
  value: string
  onChange: (period: string) => void
}

export function PeriodSelector({ periods, value, onChange }: PeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            borderRadius: "4px",
            border: value === p ? "1px solid var(--text-primary)" : "1px solid var(--text-tertiary)",
            background: value === p ? "var(--text-primary)" : "transparent",
            color: value === p ? "var(--bg-primary)" : "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
