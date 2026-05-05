"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/agents", label: "Explore" },
  { href: "/docs", label: "Docs" },
  { href: "/register", label: "Register Agent" },
]

const footerItems = [
  { href: "/agents", label: "Explore" },
  { href: "/docs", label: "Docs" },
  { href: "/register", label: "Register agent" },
  { href: "/skills", label: "MCP & AI Skill" },
  { href: "/llms.txt", label: "LLMs.txt" },
  { href: "/sitemap.xml", label: "Sitemap" },
]

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function navClass(active: boolean): string {
  return [
    "border-b border-transparent font-mono text-xs whitespace-nowrap transition-all hover:border-current hover:text-accent outline-none",
    active ? "border-current text-accent" : "text-muted",
  ].join(" ")
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen px-5 py-8 pb-12">
      <header className="mx-auto mb-7 flex max-w-[1040px] items-baseline justify-between gap-4 rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 px-5 py-[18px] pb-4 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl max-[720px]:grid max-[720px]:gap-3 max-[720px]:px-4">
        <div className="flex items-center gap-3.5 max-[720px]:items-start">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-accent bg-gradient-to-br from-accent/15 to-accent-secondary/10 text-sm font-bold tracking-wider text-accent shadow-[0_0_16px_rgba(245,158,11,0.15)] font-heading uppercase" aria-hidden="true">
            <span>AP</span>
          </div>
          <div className="grid gap-1">
            <p className="font-mono text-xs font-bold tracking-wider uppercase text-muted">Trust Registry / Stellar Testnet</p>
            <Link className="font-heading text-lg font-bold text-foreground" href="/">
              AgentPassport
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4 max-[720px]:flex-wrap max-[720px]:gap-2">
          <p className="m-0 text-muted max-[720px]:w-full">Public reputation records derived from verified paid interactions.</p>
          {navItems.map((item) => (
            <Link key={item.href} className={navClass(isActive(pathname, item.href))} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="mx-auto block max-w-[1040px]">{children}</main>

      <footer className="mx-auto mt-6 flex max-w-[1040px] flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-border-strong/40 px-4 pt-3.5 text-muted max-[720px]:mt-4 max-[720px]:pt-3">
        <p className="font-mono text-[11px] uppercase tracking-wider">AgentPassport</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 font-mono text-sm tracking-wider uppercase">
          {footerItems.map((item) => (
            <Link key={item.href} className={navClass(isActive(pathname, item.href))} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}
