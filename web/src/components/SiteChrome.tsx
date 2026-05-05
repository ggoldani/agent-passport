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
        <Link className="flex items-center shrink-0" href="/" aria-label="AgentPassport home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-transparent.png" alt="AgentPassport" height={36} className="h-9 w-auto max-[480px]:h-7" />
        </Link>
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
