import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AppConfig } from "./config.js";
import { registerContractTools } from "./registerContractTools.js";

export function createServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: "agent-passport-contract",
    version: "0.0.0"
  });
  registerContractTools(server, config);
  return server;
}
