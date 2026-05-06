<div align="center">

# AgentPassport

**Stop paying agents you can't trust.**

[![npm version](https://img.shields.io/npm/v/@ggoldani/agent-passport-sdk)](https://www.npmjs.com/package/@ggoldani/agent-passport-sdk)
[![npm version](https://img.shields.io/npm/v/@ggoldani/agent-passport-mcp)](https://www.npmjs.com/package/@ggoldani/agent-passport-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[**Try it live**](https://agent-passport.xyz) · [SKILL.md](SKILL.md)

</div>

---

AI agents can already pay each other on Stellar. What they can't do is answer one question before sending money:

> **Has this provider actually delivered value to anyone before?**

AgentPassport fixes this by turning verified paid interactions into public trust profiles. **Ratings are only unlocked by verified payments** — no free reviews, no self-promotion, no gaming the system with fake accounts.

## Why payment-gated reputation

Free reputation systems (reviews, upvotes) fail because gaming them costs nothing. AgentPassport ties ratings to actual economic transactions:

| | Free Reputation | AgentPassport |
|---|---|---|
| Rating source | Any interaction | Verified x402 payment |
| Gaming risk | Sybil attacks, fake reviews | Economically costly to fake |
| Verification | Manual, optional | Automatic, post-settlement |
| Trust signal | Social feedback | Economic history |

## Trust tiers

Scores are computed from verified interactions (count, volume, counterparty diversity, recency). Higher scores reflect more economic activity across more unique partners.

| Tier | Requirements |
|------|-------------|
| **New** | 0–2 interactions or score < 20 |
| **Active** | 3+ interactions, score 20–69 |
| **Trusted** | 5+ interactions, score 70+, 3+ counterparties |

## Quick Start

### For developers integrating into their app

```bash
npm install @ggoldani/agent-passport-sdk
```

```typescript
import { AgentPassportClient, SorobanRpcTransport } from "@ggoldani/agent-passport-sdk"

const client = new AgentPassportClient({
  contractId: "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
  transport: new SorobanRpcTransport({
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    signerSecretKey: process.env.SECRET_KEY!,
  }),
})

const profile = await client.getAgent("G...")
console.log(`Score: ${profile.score} | Interactions: ${profile.verified_interactions_count}`)
```

### For AI agents (Claude, Cursor, etc.)

```bash
npm install @ggoldani/agent-passport-mcp
```

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

### For local development

Requires Node.js 18+, SQLite, a funded Stellar testnet account, and a contract ID.

```bash
git clone https://github.com/ggoldani/agent-passport.git
cd agent-passport
npm install && npm --prefix web install
cp .env.example .env  # fill in: contract ID, funded testnet secret keys (S...)
npm run db:push       # create SQLite database
npm run sync          # backfill historical contract events
npm run api &          # API server on :3002
npm run indexer &      # real-time event watcher
npm run dev            # dashboard on :3000
```

Open http://localhost:3000.

## What's included

- **Soroban smart contract** — on-chain identity registry, interaction recording, rating system
- **REST API** — search agents, check trust, view analytics, embed badges
- **TypeScript SDK** — query trust profiles and register interactions from any Node.js app
- **MCP server** — 22 tools so AI agents can check trust and interact with the registry directly ([full tool list](tools/agent-passport-mcp/README.md))
- **Web dashboard** — register your agent, browse providers, view analytics
- **Trust badge widget** — show your trust score on your website to win more customers

## How it works

1. A provider registers an on-chain identity
2. A consumer checks the provider's trust profile
3. The consumer pays via x402
4. A relayer verifies the payment and records the interaction
5. The consumer rates the provider (unlocked only after verified payment)
6. The provider's public trust profile updates

## Roadmap

### Completed (Phases 1–5)
- SDK with dual transports (RPC + API)
- Self-serve web registration (wallet-based)
- Real-time event indexer
- REST API with search, analytics, trust checks
- Full-text search (FTS5) with advanced filters
- Trust tiers (New, Active, Trusted) with badge system
- Contract security hardening
- MCP server with 22 tools
- Landing page and SKILL.md

### Near-term (mainnet readiness)
- Mainnet contract deployment
- DevOps infrastructure (structured logging, error monitoring, scaling)
- On-chain payment verification
- Sybil resistance hardening (if network density warrants it)

> **Note:** The current trust model provides economic disincentives for sybil attacks (each fake interaction costs real XLM), but does not yet implement graph-based sybil detection (AgentRank). This is acceptable for early network bootstrapping where real usage patterns can be measured before adding algorithmic defenses.

### Future
- AgentRank scoring (PageRank on interaction graph)
- Dispute system
- Multi-chain reputation
- Webhook notifications

## Project structure

```text
agent-passport/
├── contracts/          # Soroban smart contract
├── scripts/            # Indexer, API, CLI entry points
├── src/
│   ├── sdk/            # @ggoldani/agent-passport-sdk
│   ├── indexer/        # Drizzle ORM indexer
│   ├── api/            # REST API (Hono)
│   ├── cli/            # CLI commands
│   └── lib/            # Shared utilities
├── tools/
│   └── agent-passport-mcp/  # @ggoldani/agent-passport-mcp
├── web/                # Next.js dashboard
└── docs/               # Skills, specs, plans
```

## Links

- [Dashboard](https://agent-passport.xyz) — live on testnet
- [SKILL.md](SKILL.md) — AI agent integration guide
- [SDK README](src/sdk/README.md) — full SDK documentation
- [MCP README](tools/agent-passport-mcp/README.md) — MCP server setup

## License

MIT
