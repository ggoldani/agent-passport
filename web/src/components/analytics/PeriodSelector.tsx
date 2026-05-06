"use client"

interface PeriodSelectorProps {
  periods: string[]
  value: string
  onChange: (period: string) => void
}

export function PeriodSelector({ periods, value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1">
      {periods.map((p) => {
        const isActive = value === p
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
              isActive
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-background)] font-semibold"
                : "border-[var(--color-muted)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}
