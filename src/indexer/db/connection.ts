import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "./schema.js"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _rawDb: Database.Database | null = null

export function getDatabase(dbPath?: string): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db
  const resolvedPath = dbPath ?? resolve(process.cwd(), ".agent-passport/indexer.db")
  const dir = resolve(resolvedPath, "..")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  _rawDb = new Database(resolvedPath)
  _rawDb.pragma("journal_mode = WAL")
  _rawDb.pragma("foreign_keys = ON")
  _rawDb.pragma("busy_timeout = 5000")

  _rawDb.exec(`
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

    CREATE VIRTUAL TABLE IF NOT EXISTS agents_fts USING fts5(name, description, content=agents, content_rowid=rowid);

    CREATE TRIGGER IF NOT EXISTS agents_fts_insert AFTER INSERT ON agents BEGIN
      INSERT INTO agents_fts(rowid, name, description) VALUES (NEW.rowid, NEW.name, NEW.description);
    END;

    CREATE TRIGGER IF NOT EXISTS agents_fts_update AFTER UPDATE ON agents BEGIN
      INSERT INTO agents_fts(agents_fts, rowid, name, description)
      VALUES ('delete', OLD.rowid, OLD.name, OLD.description);
      INSERT INTO agents_fts(rowid, name, description) VALUES (NEW.rowid, NEW.name, NEW.description);
    END;

    CREATE TRIGGER IF NOT EXISTS agents_fts_delete AFTER DELETE ON agents BEGIN
      INSERT INTO agents_fts(agents_fts, rowid, name, description)
      VALUES ('delete', OLD.rowid, OLD.name, OLD.description);
    END;

    CREATE TABLE IF NOT EXISTS rich_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_tx_hash TEXT NOT NULL UNIQUE,
      provider_address TEXT NOT NULL,
      consumer_address TEXT NOT NULL,
      quality INTEGER,
      speed INTEGER,
      reliability INTEGER,
      communication INTEGER,
      comment TEXT,
      submitted_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agents_score ON agents(score);
    CREATE INDEX IF NOT EXISTS idx_agents_interactions ON agents(verified_interactions_count);
    CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(created_at);
    CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_interactions_consumer ON interactions(consumer_address);
  `)

  const existingColumns = _rawDb.prepare("SELECT name FROM pragma_table_info('agents')").all() as { name: string }[]
  const columnNames = new Set(existingColumns.map(c => c.name))
  if (!columnNames.has("trust_tier")) {
    _rawDb.exec("ALTER TABLE agents ADD COLUMN trust_tier TEXT")
  }

  const richRatingsColumns = _rawDb.prepare("SELECT name FROM pragma_table_info('rich_ratings')").all() as { name: string }[]
  const richRatingsColumnNames = new Set(richRatingsColumns.map(c => c.name))
  if (!richRatingsColumnNames.has("provider_address")) {
    _rawDb.exec("ALTER TABLE rich_ratings ADD COLUMN provider_address TEXT NOT NULL DEFAULT ''")
  }
  if (!richRatingsColumnNames.has("consumer_address")) {
    _rawDb.exec("ALTER TABLE rich_ratings ADD COLUMN consumer_address TEXT NOT NULL DEFAULT ''")
  }

  const ftsCount = _rawDb.prepare("SELECT COUNT(*) as count FROM agents_fts").get() as { count: number }
  if (ftsCount.count === 0) {
    const agentCount = _rawDb.prepare("SELECT COUNT(*) as count FROM agents").get() as { count: number }
    if (agentCount.count > 0) {
      _rawDb.exec("INSERT INTO agents_fts(rowid, name, description) SELECT rowid, name, description FROM agents")
    }
  }

  const richRatingsCount = _rawDb.prepare("SELECT COUNT(*) as count FROM rich_ratings").get() as { count: number }
  if (richRatingsCount.count === 0) {
    const ratingsFile = resolve(process.cwd(), ".agent-passport/ratings.json")
    if (existsSync(ratingsFile)) {
      try {
        const raw = readFileSync(ratingsFile, "utf8")
        const records = JSON.parse(raw)
        if (Array.isArray(records)) {
          const insert = _rawDb.prepare(
            "INSERT INTO rich_ratings (interaction_tx_hash, provider_address, consumer_address, quality, speed, reliability, communication, comment, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          for (const r of records) {
            if (typeof r.interaction_tx_hash === "string" && typeof r.submitted_at === "string") {
              insert.run(
                r.interaction_tx_hash,
                r.provider_address ?? "",
                r.consumer_address ?? "",
                r.quality ?? null,
                r.speed ?? null,
                r.reliability ?? null,
                r.communication ?? null,
                r.comment ?? null,
                Math.floor(new Date(r.submitted_at).getTime() / 1000)
              )
            }
          }
          console.log(`Migrated ${records.length} rich ratings from ratings.json to DB`)
        }
      } catch (e) {
        console.error("Failed to migrate rich ratings:", e)
      }
    }
  }

  _db = drizzle(_rawDb, { schema })
  return _db
}

export function getRawDb(): Database.Database {
  if (!_rawDb) getDatabase()
  return _rawDb!
}
