#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { redactSensitiveText } from "./lib/redact.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("agent-passport-contract MCP (stdio) ready.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Fatal startup error:", redactSensitiveText(message));
  process.exit(1);
});
