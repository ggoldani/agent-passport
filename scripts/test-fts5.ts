import Database from "better-sqlite3"
import { existsSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"

const dbPath = resolve(process.cwd(), ".agent-passport/test-fts5.db")
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    owner_address TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    tags TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    verified_interactions_count INTEGER NOT NULL DEFAULT 0,
    total_economic_volume TEXT NOT NULL DEFAULT '0',
    unique_counterparties_count INTEGER NOT NULL DEFAULT 0,
    last_interaction_timestamp INTEGER,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
`)

db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS agents_fts USING fts5(name, description, content=agents, content_rowid=rowid);
`)

db.exec(`
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
`)

db.prepare("INSERT INTO agents (owner_address, name, description, tags, score, updated_at) VALUES (?, ?, ?, '[]', 80, 1000000)")
  .run("GAAAA", "DeFi Analytics", "Provides on-chain DeFi analytics for agents")
db.prepare("INSERT INTO agents (owner_address, name, description, tags, score, updated_at) VALUES (?, ?, ?, '[]', 60, 1000000)")
  .run("GBBBB", "Payment Provider", "Handles x402 payment processing")

const results = db.prepare(`
  SELECT agents.* FROM agents_fts
  INNER JOIN agents ON agents.rowid = agents_fts.rowid
  WHERE agents_fts MATCH ?
  ORDER BY bm25(agents_fts)
`).all("DeFi analytics")

console.log("FTS5 results:", results)
console.log("Count:", results.length)

db.prepare("UPDATE agents SET name = ?, description = ?, score = 70 WHERE owner_address = ?")
  .run("DeFi Analytics v2", "Updated DeFi analytics", "GAAAA")

const afterUpdate = db.prepare(`
  SELECT agents.* FROM agents_fts
  INNER JOIN agents ON agents.rowid = agents_fts.rowid
  WHERE agents_fts MATCH ?
  ORDER BY bm25(agents_fts)
`).all("analytics")

console.log("After update:", afterUpdate)

db.prepare("DELETE FROM agents WHERE owner_address = ?").run("GAAAA")

const afterDelete = db.prepare(`
  SELECT agents.* FROM agents_fts
  INNER JOIN agents ON agents.rowid = agents_fts.rowid
  WHERE agents_fts MATCH ?
  ORDER BY bm25(agents_fts)
`).all("analytics")

console.log("After delete:", afterDelete)
console.log("Delete count:", afterDelete.length)

db.close()
if (existsSync(dbPath)) unlinkSync(dbPath)
