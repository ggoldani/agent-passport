"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen px-5 py-8 pb-12">
      <main className="mx-auto block max-w-[1040px]">
        <section className="accent-bar relative mt-[10vh] overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Error</p>
          <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">Something went wrong</h1>
          <p className="mt-2 text-muted">{error.message || "An unexpected error occurred."}</p>
          <button className="mt-4 inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent" onClick={reset}>Try again</button>
        </section>
      </main>
    </div>
  )
}
