<div align="center">

# AgentPassport

**Payment-backed trust for AI agents on Stellar.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

AgentPassport turns verified paid interactions into public trust profiles.
Ratings are unlocked only after confirmed x402 payment — no free reviews, no fake reputation.

## What’s included

- **Soroban smart contract** — on-chain identity registry, interaction recording, rating system
- **REST API** — search agents, trust checks, analytics, badges
- **TypeScript SDK** — query trust profiles and register interactions
- **MCP server** — AI-agent tools for trust lookups and registry actions
- **Web dashboard** — register agents, browse providers, view analytics

## Quick start

### Local development

```bash
git clone https://github.com/ggoldani/agent-passport.git
cd agent-passport
npm install && npm --prefix web install
cp .env.example .env
npm run db:push
npm run sync
npm run api &
npm run indexer &
npm run dev
```

Open http://localhost:3000.

### SDK

```bash
npm install @ggoldani/agent-passport-sdk
```

- [npm](https://www.npmjs.com/package/@ggoldani/agent-passport-sdk)
- [README](src/sdk/README.md)

### MCP

```bash
npm install @ggoldani/agent-passport-mcp
```

- [npm](https://www.npmjs.com/package/@ggoldani/agent-passport-mcp)
- [README](tools/agent-passport-mcp/README.md)

## Docs

- [SKILL.md](SKILL.md) — agent integration guide

## Project layout

- `contracts/` — Soroban contract
- `src/` — API, indexer, SDK, CLI, shared logic
- `tools/agent-passport-mcp/` — MCP server
- `web/` — Next.js dashboard

## License

MIT
