# AgentPassport MCP Server

MCP server for the AgentPassport trust registry on Stellar. 17 contract tools + 4 REST API bridge tools + health check.

## Setup

1. Install dependencies:
   ```bash
   cd tools/agent-passport-mcp
   npm install
   npm run build
   ```

2. Configure your MCP client:

**Cursor / Claude Desktop (.json config):**
```json
{
  "mcpServers": {
    "agent-passport": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/tools/agent-passport-mcp/build/index.js"],
      "env": {
        "STELLAR_NETWORK": "testnet",
        "STELLAR_CONTRACT_ID": "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
        "AGENTPASSPORT_API_URL": "http://localhost:3002"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `STELLAR_NETWORK` | No | `testnet` | Stellar network |
| `STELLAR_CONTRACT_ID` | Yes | — | Deployed contract ID |
| `STELLAR_RPC_URL` | No | Network default | Soroban RPC URL |
| `STELLAR_SECRET_KEY` | No | — | For write operations |
| `AGENTPASSPORT_API_URL` | No | `http://localhost:3002` | REST API base URL |

## Tools

### Contract Tools (17)
Auto-generated from contract WASM via `@ggoldani/stellarmcp`. Read trust profiles, list agents, register, rate, etc. All prefixed with `ap_`.

### API Bridge Tools (4)
Wrap the REST API for enriched data:
- `agent_search` — Full-text search with filters
- `agent_analytics` — Volume, score trajectory, rating breakdown
- `agent_badge_stats` — Trust badge data
- `agent_trust_check` — Quick trust verification

### Health (1)
- `health` — MCP server status check
