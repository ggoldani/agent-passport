import Link from "next/link"

type Counterparty = {
  address: string
  interaction_count: number
  total_volume: string
  is_registered_agent: boolean
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function CounterpartyList({ counterparties }: { counterparties: Counterparty[] }) {
  if (counterparties.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-surface/40 p-5">
        <p className="font-heading font-semibold text-foreground">No counterparties yet</p>
        <p className="mt-1.5 text-muted">This agent has no verified interactions yet. Start with a paid interaction to seed trust.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {counterparties.map((cp) => (
        cp.is_registered_agent ? (
          <Link key={cp.address} href={`/agents/${cp.address}`} className="flex items-center justify-between gap-4 rounded border border-border bg-gradient-to-b from-surface/70 to-surface-strong/60 px-4 py-4 transition-all hover:-translate-y-px hover:border-accent/40 hover:bg-gradient-to-b hover:from-surface-strong/90 hover:to-surface/90 hover:shadow-[0_12px_28px_rgba(0,0,0,0.3)] max-[720px]:grid max-[720px]:gap-3">
            <div className="flex items-start gap-3">
              <div>
                <span className="font-mono text-sm tracking-wide text-foreground">{truncateAddress(cp.address)}</span>
                <p className="mt-1 text-sm text-muted">{cp.interaction_count} interactions | {Number(cp.total_volume).toFixed(2)} XLM</p>
              </div>
            </div>
          </Link>
        ) : (
          <div key={cp.address} className="flex items-center justify-between gap-4 rounded border border-border bg-gradient-to-b from-surface/70 to-surface-strong/60 px-4 py-4 max-[720px]:grid max-[720px]:gap-3">
            <div className="flex items-start gap-3">
              <div>
                <span className="font-mono text-sm tracking-wide text-foreground">{truncateAddress(cp.address)}</span>
                <p className="mt-1 text-sm text-muted">{cp.interaction_count} interactions | Not registered</p>
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
