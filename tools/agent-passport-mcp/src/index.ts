import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./generated/src/config.js";
import { registerContractTools } from "./generated/src/registerContractTools.js";
import { registerApiBridgeTools } from "./api-bridge/index.js";

const server = new McpServer({
  name: "agent-passport",
  version: "0.1.0",
});

server.tool("health", "Check MCP server status", {}, async () => ({
  content: [{ type: "text", text: "AgentPassport MCP server is running" }],
}));

async function main() {
  const config = loadConfig();
  registerContractTools(server, config);
  registerApiBridgeTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
