# @ggoldani/agent-passport-mcp

MCP server for the [AgentPassport](https://github.com/ggoldani/agent-passport) trust registry on Stellar. 18 contract tools + 4 REST API bridge tools + health check.

## Install

```bash
npm install @ggoldani/agent-passport-mcp
```

## Setup

Configure your MCP client:

**Cursor / Claude Desktop:**
```json
{
  "mcpServers": {
    "agent-passport": {
      "type": "stdio",
      "command": "npx",
      "args": ["@ggoldani/agent-passport-mcp"],
      "env": {
        "STELLAR_NETWORK": "testnet",
        "STELLAR_CONTRACT_ID": "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
        "AGENTPASSPORT_API_URL": "https://agent-passport.xyz"
      }
    }
  }
}
```

**With write access (admin operations):**
```json
{
  "mcpServers": {
    "agent-passport": {
      "type": "stdio",
      "command": "npx",
      "args": ["@ggoldani/agent-passport-mcp"],
      "env": {
        "STELLAR_NETWORK": "testnet",
        "STELLAR_CONTRACT_ID": "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
        "STELLAR_SECRET_KEY": "S...",
        "AGENTPASSPORT_API_URL": "https://agent-passport.xyz"
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

### Contract Tools (18)
Auto-generated from contract WASM via `@ggoldani/stellarmcp`. All prefixed with `ap_`:

| Tool | Description |
|------|-------------|
| `ap_get_agent` | Fetch agent profile by address |
| `ap_list_agents` | Paginated agent list |
| `ap_get_config` | Contract configuration |
| `ap_get_relayers` | Authorized relayers |
| `ap_get_rating` | Rating for an interaction |
| `ap_list_agent_interactions` | Interaction history |
| `ap_register_agent` | Register new agent |
| `ap_update_profile` | Update agent profile |
| `ap_deregister_agent` | Remove agent |
| `ap_register_interaction` | Record interaction |
| `ap_submit_rating` | Rate an interaction (1-100) |
| `ap_add_relayer` | Authorize relayer |
| `ap_remove_relayer` | Revoke relayer |
| `ap_transfer_admin` | Initiate admin transfer |
| `ap_accept_admin` | Accept admin transfer |
| `ap_cancel_admin_transfer` | Cancel pending transfer |
| `ap_init` | Initialize contract |

### API Bridge Tools (4)
Wrap the REST API for enriched data:
- `agent_search` — Full-text search with filters
- `agent_analytics` — Volume, score trajectory, rating breakdown
- `agent_badge_stats` — Trust badge data
- `agent_trust_check` — Quick trust verification

### Health (1)
- `health` — MCP server status check

## License

MIT
