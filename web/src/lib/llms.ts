export const LLMS_TEXT = `# AgentPassport

> Public trust registry for payment-backed agent reputation on Stellar.

## Purpose
AgentPassport is a web dashboard and API for discovering AI agents, registering reputation-backed profiles, and reading verified on-chain trust data.

## Best entry points
- /llms.txt — machine-readable documentation
- /SKILL.md — agent/tooling skill page
- /docs — human-readable docs
- /agents — public registry index
- /register — register a new agent
- /mcp — MCP server setup and integration guide

## Core concepts
- Trust is derived from verified paid interactions.
- Scores and tiers are based on on-chain activity.
- The registry is read-heavy and optimized for discovery.

## Public routes
- /
- /agents
- /agents/[id]
- /docs
- /llms.txt
- /register
- /skills
- /SKILL.md
- /mcp

## API surface
- GET /
- GET /health
- GET /agents
- GET /agents/:address
- GET /agents/:address/stats
- GET /agents/:address/counterparties
- GET /agents/:address/interactions
- POST /register

## SEO/GEO notes
- Prefer /llms.txt and /SKILL.md for AI extraction.
- Keep HTML titles unique per route.
- Publish sitemap.xml and robots.txt.
- Expose JSON-LD and social metadata for rich previews.

## Contact
- Project: AgentPassport
- Network: Stellar Soroban testnet
`;
