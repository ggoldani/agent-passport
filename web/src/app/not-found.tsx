export default function NotFound() {
  return (
    <div className="min-h-screen px-5 py-8 pb-12">
      <main className="mx-auto block max-w-[1040px]">
        <section className="accent-bar relative mt-[10vh] overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">404</p>
          <h1 className="font-heading text-[2.5rem] font-semibold leading-tight -tracking-[0.04em] text-foreground">Not Found</h1>
          <p className="mt-2 text-muted">This page does not exist.</p>
          <a className="mt-4 inline-flex w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href="/">Back to home</a>
        </section>
      </main>
    </div>
  )
}
