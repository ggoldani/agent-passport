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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      owner_address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL,
      service_url TEXT,
      mcp_server_url TEXT,
      payment_endpoint TEXT,
      created_at INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      verified_interactions_count INTEGER NOT NULL DEFAULT 0,
      total_economic_volume TEXT NOT NULL DEFAULT '0',
      unique_counterparties_count INTEGER NOT NULL DEFAULT 0,
      last_interaction_timestamp INTEGER,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_address TEXT NOT NULL,
      consumer_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      amount TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      service_label TEXT,
      ledger INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_address TEXT NOT NULL,
      consumer_address TEXT NOT NULL,
      interaction_tx_hash TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      ledger INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS indexer_watermark (
      key TEXT PRIMARY KEY,
      ledger INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_interactions_provider ON interactions(provider_address);
    CREATE INDEX IF NOT EXISTS idx_ratings_provider ON ratings(provider_address);
    CREATE INDEX IF NOT EXISTS idx_ratings_tx_hash ON ratings(interaction_tx_hash);
  `)

  _db = drizzle(sqlite, { schema })
  return _db
}
