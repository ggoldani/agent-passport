import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const agents = sqliteTable("agents", {
  owner_address: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  tags: text().notNull(),
  service_url: text(),
  mcp_server_url: text(),
  payment_endpoint: text(),
  created_at: integer().notNull(),
  score: integer().notNull().default(0),
  verified_interactions_count: integer().notNull().default(0),
  total_economic_volume: text().notNull().default("0"),
  unique_counterparties_count: integer().notNull().default(0),
  last_interaction_timestamp: integer(),
  updated_at: integer().notNull().default(0),
})

export const interactions = sqliteTable("interactions", {
  id: integer().primaryKey({ autoIncrement: true }),
  provider_address: text().notNull(),
  consumer_address: text().notNull(),
  tx_hash: text().notNull().unique(),
  amount: text().notNull(),
  timestamp: integer().notNull(),
  service_label: text(),
  ledger: integer().notNull(),
})

export const ratings = sqliteTable("ratings", {
  id: integer().primaryKey({ autoIncrement: true }),
  provider_address: text().notNull(),
  consumer_address: text().notNull(),
  interaction_tx_hash: text().notNull().unique(),
  score: integer().notNull(),
  timestamp: integer().notNull(),
  ledger: integer().notNull(),
})

export const indexerWatermark = sqliteTable("indexer_watermark", {
  key: text().primaryKey(),
  ledger: integer().notNull(),
  updated_at: integer().notNull().default(0),
})

export const richRatings = sqliteTable("rich_ratings", {
  id: integer().primaryKey({ autoIncrement: true }),
  interaction_tx_hash: text().notNull().unique(),
  provider_address: text().notNull(),
  consumer_address: text().notNull(),
  score: integer(),
  quality: integer(),
  speed: integer(),
  reliability: integer(),
  communication: integer(),
  comment: text(),
  submitted_at: integer().notNull(),
})
