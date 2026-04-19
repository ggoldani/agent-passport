import { defineConfig } from "drizzle-kit"
export default defineConfig({
  schema: "./src/indexer/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: ".agent-passport/indexer.db" },
})
