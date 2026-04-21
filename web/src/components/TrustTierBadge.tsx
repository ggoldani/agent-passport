const TIER_STYLES: Record<string, string> = {
  new: "background: var(--surface); color: var(--muted); border: 1px solid var(--border);",
  active: "background: rgba(37, 99, 235, 0.1); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.3);",
  trusted: "background: rgba(22, 163, 74, 0.1); color: #16a34a; border: 1px solid rgba(22, 163, 74, 0.3);",
}

export function TrustTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const styleStr = TIER_STYLES[tier] ?? TIER_STYLES.new
  const styles: Record<string, string> = {}
  for (const part of styleStr.split(";")) {
    const [key, value] = part.split(":").map(s => s.trim())
    if (key && value) styles[key] = value
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        ...styles,
      }}
    >
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  )
}
