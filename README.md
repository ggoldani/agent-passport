# AgentPassport

**Payment-backed trust layer for AI agents on Stellar**

AgentPassport lets agents and services on Stellar build a public reputation from real paid interactions, so the ecosystem can move from blind trust to verifiable trust.

It answers a simple question that the agent economy still struggles with:

> Can I trust this provider before I pay it?

## Why this exists

Stellar already has the payment rails for the agent economy: x402, fast settlement, low fees, and smart accounts.

What it still lacks is trust.

An agent can already pay on Stellar. What it still cannot reliably answer is:
- Who is this agent?
- Has it completed real paid work before?
- How many counterparties have trusted it?
- What economic history backs its reputation?
- Should I pay this provider at all?

AgentPassport solves this by turning verified paid interactions into a queryable public trust profile that agents and developers can check before and after payment.

## Why this matters now

x402 solves payment execution.
It does not solve counterparty selection.

If agents are going to buy services programmatically, they need a simple way to evaluate who has real economic history behind them before sending money.

AgentPassport makes that decision legible by exposing a public trust profile backed by verified paid interactions.

Providers use it to build public trust from real paid work.
Consumers use it to decide which providers are worth paying.

## How it works

At a high level:
- a provider registers a public identity on-chain
- a consumer checks that provider's trust profile
- the consumer pays via x402
- AgentPassport verifies the paid interaction and updates the provider's public trust state
- the consumer can rate the provider only after that verified interaction exists

## What AgentPassport does

- lets providers register an on-chain identity on Soroban
- records verified paid interactions
- allows ratings only after verified payment-backed interactions
- helps consumers query trust before payment and helps providers prove trust after delivery
- exposes a public trust profile with:
  - score
  - verified interactions count
  - total economic volume
  - unique counterparties count
  - recent activity
- provides a reusable trust primitive for future Stellar marketplaces, directories, MCP services, and agent networks

## Canonical demo

The hackathon demo uses one concrete flow:

1. **StellarIntel** (a paid Stellar intelligence provider) registers on AgentPassport
2. A consumer checks StellarIntel's public trust profile before paying
3. The trust profile shows score, verified interactions, economic volume, and counterparties
4. The consumer decides to use StellarIntel and pays via x402 on Stellar
5. A relayer verifies the payment and registers the interaction on Soroban
6. The consumer submits a rating
7. StellarIntel's public trust profile updates

This is the core idea:

> **x402 gives Stellar agents the ability to pay. AgentPassport gives them the ability to trust.**

And this is the non-negotiable rule behind the system:

> **Ratings are not free-form reviews. They are unlocked only by verified paid interactions.**

## Why this is different from a review site

- no free-form anonymous reviews
- no ratings without a verified payment-backed interaction
- trust is tied to economic history, not social signaling alone
- the same trust profile is useful both before payment decisions and after service delivery

## Scope of the MVP

### Included
- Soroban-based identity registry
- verified interaction registration
- rating-based reputation
- trusted relayer flow
- CLI surfaces for register/query/list/rate/interactions
- local dashboard for demo
- minimal provider service (**StellarIntel**) for the end-to-end paid interaction demo
- deterministic account analysis using live Stellar data via a local companion service
- end-to-end demo script that runs the trust flow on Stellar testnet

### Not included
- decentralized attestation network
- dispute system
- staking / slashing
- MPP support in MVP
- marketplace layer
- tokenomics

## Project structure

```text
agent-passport/
├── contracts/
├── scripts/
├── src/
├── web/
└── README.md
```

## What's implemented now

- Soroban contract for agent registration, verified interactions, relayer-gated writes, and post-interaction ratings
- worker that verifies Horizon data and submits interaction registration on-chain
- Hono/x402 provider (**StellarIntel**) with one paid `POST /analyze-account` route
- local CLI with the canonical command surface:
  - `agent_register`
  - `agent_query`
  - `agent_list`
  - `agent_rate`
  - `agent_interactions`
- Next.js dashboard with live leaderboard and live agent detail pages
- demo script that exercises the full trust loop on Stellar testnet

CLI note:
- the current CLI is intentionally in `prepared` mode for the MVP
- it validates and normalizes the canonical command surface, but the live execution path demonstrated in the hackathon flow is `npm run demo`

This is not a mock architecture. The MVP has already been exercised end-to-end on Stellar testnet with:
- real x402 payment flow
- real on-chain interaction registration
- real post-interaction rating
- live dashboard reads from the deployed contract

Demo contract on Stellar testnet:
- `CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F`
- https://stellar.expert/explorer/testnet/contract/CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F

Demo provider address:
- `GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT`
- https://stellar.expert/explorer/testnet/account/GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT

## Quick Start

### One command

```bash
git clone https://github.com/ggoldani/agent-passport.git
cd agent-passport
chmod +x setup.sh
./setup.sh
```

The script clones [stellar-mcp](https://github.com/ggoldani/stellar-mcp), installs all dependencies, starts all services, and runs health checks. Once running:

- **Dashboard:** http://localhost:3000
- **Provider trust profile:** http://localhost:3000/agents/GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT

Run the full demo:

```bash
npm run demo
```

Press `Ctrl+C` to stop all services.

### Manual setup

```bash
git clone https://github.com/ggoldani/agent-passport.git
git clone https://github.com/ggoldani/stellar-mcp.git

# Build stellar-mcp
cd stellar-mcp && npm install && npm run build

# Setup agent-passport
cd ../agent-passport
cp .env.demo .env
npm install && npm --prefix web install

# Terminal A — stellar-mcp
cd ../stellar-mcp
MCP_TRANSPORT=http-sse PORT=3005 STELLAR_NETWORK=testnet npm run start:http

# Terminal B — provider
cd ../agent-passport
set -a && . ./.env && npm run provider

# Terminal C — dashboard
cd ../agent-passport
set -a && . ./.env && npm run dashboard

# Run the demo
cd ../agent-passport
set -a && . ./.env && npm run demo
```

### Useful commands

- `npm run contracts` — run Soroban contract tests
- `npm run provider` — start StellarIntel provider
- `npm run cli -- help` — AgentPassport CLI
- `npm run demo` — full end-to-end demo
- `npm run dashboard` — start Next.js dashboard

## Supporting demo provider

This repository also includes **StellarIntel**, a minimal paid Stellar account intelligence service used to make the AgentPassport trust flow concrete and demoable.

StellarIntel exists to show the full loop clearly:
- a provider can build trust from real paid work
- a consumer can inspect that trust before paying
- reputation changes only after a verified paid interaction

StellarIntel is intentionally narrow:
- one paid endpoint
- one Stellar account input
- real data from the Stellar network
- deterministic summary logic
- no LLM required for MVP

In the current implementation:
- the provider owner identity is separate from the relayer identity
- the provider receives the x402 payment
- the relayer only performs the trusted on-chain write after settlement verification

## Ecosystem context

AgentPassport is designed to work alongside the existing Stellar agent/payment stack:
- Stellar x402
- Soroban smart contracts
- OpenZeppelin relayer / x402 facilitator
- `stellar-mcp` as ecosystem infrastructure

## What this repository is and is not

The new hackathon work in this repository is:
- the Soroban contract
- the worker and relayer-side submission flow
- the paid **StellarIntel** provider
- the CLI, dashboard, and demo orchestration

`stellar-mcp` is not the new hackathon implementation in this repo. It is an external companion service we run locally and query for live Stellar account/history data. AgentPassport depends on it for the demo provider's deterministic account analysis, but it remains separate infrastructure.

## Documentation

Planning and design docs were maintained locally during implementation in `docs/plans/`, which is intentionally ignored by git in this repo.

The tracked source of truth for the MVP is the implementation itself:
- `contracts/agent-passport/`
- `scripts/worker/`
- `src/provider/`
- `src/cli/`
- `scripts/demo-e2e.ts`
- `web/`

## Public roadmap

Short version of the next phase:
- [ ] self-serve provider onboarding around `register_agent`
- [ ] `update_agent` and full profile management
- [ ] stronger public provider pages and clearer trust tiers
- [ ] search, filters, and ranking for provider discovery
- [ ] trust analytics plus lightweight business analytics for providers
- [ ] read-first trust API for integrators and ecosystem apps
- [ ] premium verification and curation layer
- [ ] broader ecosystem distribution through registries, directories, and marketplaces

## Status

AgentPassport is now a validated MVP that is already runnable end-to-end on Stellar testnet.

Current state:
- contract, worker, provider, CLI, demo script, and dashboard are implemented for the MVP flow
- the canonical demo has already been exercised against live testnet infrastructure
- the provider identity used in the demo is now **StellarIntel**, not a relayer bootstrap placeholder
