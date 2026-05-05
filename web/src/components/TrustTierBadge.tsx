const TIER_CLASSES: Record<string, string> = {
  new: "inline-flex items-center rounded-full border border-border bg-surface px-2 py-1 text-xs font-bold uppercase tracking-wide text-muted",
  active: "inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-blue-400",
  trusted: "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.25)]",
}

export function TrustTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const className = TIER_CLASSES[tier] ?? TIER_CLASSES.new
  return <span className={className}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
}
