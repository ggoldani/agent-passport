export default function Loading() {
  return (
    <div className="mx-auto max-w-[1040px] animate-pulse space-y-6 py-4">
      <div className="h-8 w-48 rounded bg-surface-strong" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <div className="h-4 w-3/4 rounded bg-surface-strong" />
            <div className="h-3 w-1/2 rounded bg-surface-strong" />
            <div className="h-3 w-5/6 rounded bg-surface-strong" />
          </div>
        ))}
      </div>
    </div>
  )
}
