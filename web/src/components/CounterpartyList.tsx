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
      <div className="empty-state">
        <p className="empty-title">No counterparties yet</p>
        <p className="empty-copy">This agent has no verified interactions.</p>
      </div>
    )
  }

  return (
    <div className="list-reset">
      {counterparties.map((cp) => (
        cp.is_registered_agent ? (
          <Link key={cp.address} href={`/agents/${cp.address}`} className="list-row" style={{ textDecoration: "none" }}>
            <div className="row-main">
              <div>
                <span className="row-mono">{truncateAddress(cp.address)}</span>
                <p className="row-subtle">{cp.interaction_count} interactions | {Number(cp.total_volume).toFixed(2)} XLM</p>
              </div>
            </div>
          </Link>
        ) : (
          <div key={cp.address} className="list-row">
            <div className="row-main">
              <div>
                <span className="row-mono">{truncateAddress(cp.address)}</span>
                <p className="row-subtle">{cp.interaction_count} interactions | Not registered</p>
              </div>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
