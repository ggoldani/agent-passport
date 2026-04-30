# Phase 5.5: StellarMCP + AI Discovery Skills — Design Spec

**Date:** April 30, 2026
**Status:** Approved
**Effort:** Small (~2-3 days)

---

## Goal

Expose AgentPassport trust data to AI agents through two mechanisms:
1. An MCP server with 19 tools (15 contract functions + 4 REST API bridge tools)
2. A comprehensive SKILL.md file for AI agent discovery via the stellarskills convention

## Approach

**Generate + Extend.** Use `stellarmcp-generate` to auto-generate MCP tools from the contract WASM, then add custom tools that wrap the REST API for enriched data (search, analytics, badges, trust-check). Write a single SKILL.md following the stellarskills convention.

---

## 1. MCP Package

### Location

`tools/agent-passport-mcp/` in the agent-passport repo.

### Structure

```
tools/agent-passport-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── generated/            # stellarmcp-generate output (contract tools)
│   │   ├── tools/            # auto-generated Zod schemas + handlers
│   │   └── index.ts          # tool registration
│   └── api-bridge/           # custom REST API tools
│       ├── search.ts         # agent_search tool
│       ├── analytics.ts      # agent_analytics tool
│       ├── badge.ts          # agent_badge_stats tool
│       ├── trust-check.ts    # agent_trust_check tool
│       └── index.ts          # bridge tool registration
└── README.md
```

### Entry Point

`index.ts` imports generated contract tools + custom API bridge tools, registers all with the MCP server. Uses `STELLAR_NETWORK`, `STELLAR_CONTRACT_ID`, and `AGENTPASSPORT_API_URL` env vars.

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `STELLAR_NETWORK` | No | `testnet` | Stellar network (testnet/mainnet) |
| `STELLAR_CONTRACT_ID` | Yes | — | Deployed contract ID |
| `STELLAR_RPC_URL` | No | Network default | Soroban RPC URL |
| `STELLAR_SECRET_KEY` | No | — | For write operations (safe mode returns unsigned XDR) |
| `AGENTPASSPORT_API_URL` | No | `http://localhost:3002` | AgentPassport REST API base URL |

### Contract Tools (Generated via stellarmcp-generate)

Auto-generated from `contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm`.

**Read tools:**
- `get_agent` — Fetch trust profile for a single agent by address
- `list_agents` — List registered agents (paginated)
- `get_rating` — Get a specific rating by transaction hash
- `list_agent_interactions` — List interactions for an agent (paginated)
- `list_agent_ratings` — List ratings for an agent (paginated)
- `get_config` — Get contract configuration (admin, relayers)
- `get_admin` — Get current admin address
- `get_relayers` — List authorized relayers

**Write tools:**
- `register_agent` — Register a new agent profile
- `register_interaction` — Record a verified interaction
- `submit_rating` — Submit a rating for an interaction
- `update_profile` — Update an existing agent profile
- `deregister_agent` — Remove an agent profile
- `add_relayer` — Authorize a new relayer (admin only)
- `remove_relayer` — Remove a relayer (admin only)
- `transfer_admin` — Initiate admin transfer
- `accept_admin` — Accept admin transfer

### API Bridge Tools (Custom)

Wrap the REST API at `AGENTPASSPORT_API_URL`. Provide enriched data not available via contract reads alone (search, analytics, indexed data).

| Tool | Description | Parameters | API Endpoint |
|------|-------------|------------|--------------|
| `agent_search` | Search agents with full-text search and filters | `q` (string), `tags` (string), `minScore` (number), `maxScore` (number), `sortBy` (string: score/interactions/volume/newest/relevance), `limit` (number: 1-50) | `GET /agents` |
| `agent_analytics` | Get analytics for an agent | `address` (string, required), `period` (string: 7d/30d/90d/all) | `GET /agents/:address/stats` |
| `agent_badge_stats` | Get trust badge data for embedding | `address` (string, required) | `GET /badge-stats/:address` |
| `agent_trust_check` | Quick trust verification | `address` (string, required), `minScore` (number), `minInteractions` (number) | `GET /trust-check/:address` |

**Error handling:** If the API is unreachable, tools return a clear MCP tool error: `"AgentPassport API unreachable at {url}. Start the API server or set AGENTPASSPORT_API_URL."`

**Input validation:** All parameters validated with Zod schemas before API calls. Address validated with `isValidStellarAddress` pattern.

### MCP Client Configuration

```json
{
  "mcpServers": {
    "agent-passport": {
      "type": "stdio",
      "command": "node",
      "args": ["tools/agent-passport-mcp/build/src/index.js"],
      "env": {
        "STELLAR_NETWORK": "testnet",
        "STELLAR_CONTRACT_ID": "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
        "AGENTPASSPORT_API_URL": "http://localhost:3002"
      }
    }
  }
}
```

---

## 2. SKILL.md

### Location

- **In this repo:** `docs/skills/agent-passport/SKILL.md`
- **In stellarskills repo:** `agent-passport/SKILL.md` (via PR)

### Frontmatter

```yaml
---
name: agent-passport
description: On-chain trust registry for payment-backed AI agent reputation on Stellar.
when_to_use: Verifying trustworthiness of an AI agent before engaging it, checking payment-backed reputation scores, registering an AI agent on the Stellar trust registry, embedding trust badges, searching for trusted agents by capability or score.
---
```

### Content Structure

1. **What it is** — 2-3 sentences: on-chain registry, payment-verified trust, Soroban contract
2. **When to use** — scenarios where agents should consult AgentPassport
3. **Quick start** — Minimal example: trust-check an agent via MCP tools
4. **Trust tiers** — Table: New / Active / Trusted with exact thresholds
5. **MCP tools** — Table of all 19 tools with one-line descriptions
6. **Contract functions (read)** — `get_agent`, `list_agents`, `get_rating`, `list_agent_interactions`, `list_agent_ratings`, `get_config`, `get_admin`, `get_relayers`
7. **Contract functions (write)** — `register_agent`, `register_interaction`, `submit_rating`, `update_profile`, `deregister_agent`, `add_relayer`, `remove_relayer`, `transfer_admin`, `accept_admin`
8. **API bridge tools** — `agent_search`, `agent_analytics`, `agent_badge_stats`, `agent_trust_check` with parameter tables
9. **Registration workflow** — Step-by-step: generate keypair, fund, register via MCP tool or web
10. **x402 integration** — How to verify x402 payments against AgentPassport trust data
11. **Common errors** — Table: contract error codes 1-25 mapped to human-readable messages and fixes
12. **REST API reference** — Key endpoints for agents that prefer HTTP over MCP
13. **See also** — Links to stellar.expert contract, docs page, GitHub repo

### Style

Follow stellarskills golden rules:
- No fluff, no marketing copy
- Dense and factual, prioritize code snippets and exact parameter shapes
- Current and runnable against latest SDK/contract
- Isolated context (assume agent only reads this file)
- Include common errors table

---

## 3. Discovery Path

1. AI agent reads stellarskills root SKILL.md
2. Finds `agent-passport` in the skill index table
3. Fetches `agent-passport/SKILL.md` from raw.githubusercontent.com
4. Learns about all 19 MCP tools and workflows
5. Connects MCP server via client configuration
6. Uses tools directly: trust-check, search, register, verify

---

## 4. Dependencies

- `stellarmcp-generate` CLI (from `@ggoldani/stellarmcp` npm package or stellar-mcp repo)
- Contract WASM at `contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm`
- Rust toolchain with `wasm32v1-none` target (for rebuilding WASM if needed)
- REST API server running for bridge tools (optional — contract tools work without it)

---

## 5. Out of Scope

- Multi-contract MCP workspaces
- HTTP/SSE transport for the generated MCP server (stdio only, as per stellar-mcp generator)
- Automated publishing of the MCP package to npm
- Modifying the agent-passport contract
- Changes to the REST API server

---

## 6. Success Criteria

- [ ] `stellarmcp-generate` produces a working MCP package from the contract WASM
- [ ] All 15 contract functions are callable as MCP tools
- [ ] 4 custom API bridge tools work against the live API server
- [ ] MCP server starts via `node build/src/index.js` with correct env vars
- [ ] SKILL.md follows stellarskills convention and is comprehensive
- [ ] SKILL.md is submitted to stellarskills repo
- [ ] `tsc --noEmit` passes in the MCP package
