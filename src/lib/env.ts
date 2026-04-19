import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export function loadEnvFile(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env")
  if (!existsSync(envPath)) return {}
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=")
        if (idx === -1) return [line, ""] as const
        const key = line.slice(0, idx).trim()
        const raw = line.slice(idx + 1).trim()
        const val =
          raw.startsWith('"') && raw.endsWith('"')
            ? raw.slice(1, -1)
            : raw
        return [key, val] as const
      }),
  )
}

export function applyEnvFile(): void {
  const envVars = loadEnvFile()
  for (const [key, value] of Object.entries(envVars)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
