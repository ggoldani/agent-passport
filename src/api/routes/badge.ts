import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { agents } from "../../indexer/db/schema.js"
import { computeTrustTier } from "../types.js"
import { isValidStellarAddress } from "../validate.js"

type Variables = { db: any }

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function abbreviateVolume(volume: string): string {
  const num = parseFloat(volume)
  if (isNaN(num) || num === 0) return "0"
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(Math.round(num))
}

const TIER_COLORS: Record<string, string> = {
  new: "#655c52",
  active: "#2563eb",
  trusted: "#16a34a",
}

const SIZES: Record<string, { width: number; height: number; fontSize: number; badgeSize: number }> = {
  small: { width: 200, height: 40, fontSize: 10, badgeSize: 6 },
  medium: { width: 280, height: 48, fontSize: 12, badgeSize: 8 },
  large: { width: 360, height: 56, fontSize: 14, badgeSize: 10 },
}

const THEMES: Record<string, { bg: string; text: string; border: string; subtle: string }> = {
  light: { bg: "#f8f4eb", text: "#171512", border: "#b9ac97", subtle: "#655c52" },
  dark: { bg: "#171512", text: "#f8f4eb", border: "#6f6454", subtle: "#b9ac97" },
}

const app = new Hono<{ Variables: Variables }>()

app.get("/:address{.+}", async (c) => {
  const db = c.get("db")
  const fullPath = c.req.param("address")
  const address = fullPath.replace(/\.svg$/, "")
  if (!address || !isValidStellarAddress(address)) return c.json({ error: "Invalid Stellar address" }, 400)
  const theme = c.req.query("theme") === "dark" ? "dark" : "light"
  const size = SIZES[c.req.query("size") ?? "medium"] ?? SIZES.medium
  const showStats = c.req.query("stats") === "full"
  const colors = THEMES[theme]
  const midY = Math.floor(size.height / 2)

  const row = db.select().from(agents).where(eq(agents.owner_address, address)).get()
  const name = row ? row.name : address.slice(0, 8) + "..."
  const score = row ? Number(row.score) : 0
  const tier = row
    ? computeTrustTier(Number(row.verified_interactions_count), row.score, Number(row.unique_counterparties_count))
    : "new"
  const tierColor = TIER_COLORS[tier] ?? TIER_COLORS.new

  const dashboardUrl = process.env.DASHBOARD_BASE_URL ?? "https://agentpassport.example.com"
  const profileUrl = `${dashboardUrl}/agents/${address}`

  const statsHeight = showStats ? size.height : 0
  const totalHeight = size.height + statsHeight

  const statsSection = showStats ? `
    <text x="20" y="${midY + 20}" font-family="system-ui,sans-serif" font-size="${size.fontSize - 2}" fill="${colors.subtle}">
      Score: ${escapeXml(String(score))} · ${row ? Number(row.verified_interactions_count) : 0} interactions
    </text>
    <text x="20" y="${midY + 36}" font-family="system-ui,sans-serif" font-size="${size.fontSize - 2}" fill="${colors.subtle}">
      ${escapeXml(abbreviateVolume(row ? row.total_economic_volume : "0"))} volume
    </text>
  ` : ""

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${totalHeight}">
  <a href="${escapeXml(profileUrl)}" target="_blank" rel="noopener">
    <rect width="100%" height="100%" rx="6" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1"/>
    <circle cx="20" cy="${midY}" r="${size.badgeSize}" fill="${tierColor}"/>
    <text x="40" y="${midY}" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="${size.fontSize}" fill="${colors.text}" font-weight="600">
      ${escapeXml(name)}
    </text>
    <text x="100%" y="${midY}" dominant-baseline="central" text-anchor="end" dx="-12" font-family="monospace" font-size="${size.fontSize}" fill="${tierColor}" font-weight="700">
      ${score}
    </text>
    <text x="100%" y="${midY}" dominant-baseline="central" text-anchor="end" dx="-46" font-family="monospace" font-size="${size.fontSize - 2}" fill="${colors.subtle}">
      AgentPassport
    </text>
    ${statsSection}
  </a>
</svg>`

  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600",
  })
})

export default app
