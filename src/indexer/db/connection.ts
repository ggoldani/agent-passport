import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "./schema.js"
import { existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDatabase(dbPath?: string): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db
  const resolvedPath = dbPath ?? resolve(process.cwd(), ".agent-passport/indexer.db")
  const dir = resolve(resolvedPath, "..")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const sqlite = new Database(resolvedPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  sqlite.pragma("busy_timeout = 5000")
  _db = drizzle(sqlite, { schema })
  return _db
}
