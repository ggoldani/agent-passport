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
├── contracts/agent-passport/   # Soroban smart contract (Rust)
├── scripts/
│   ├── demo-e2e.ts             # End-to-end demo script
│   └── worker/                 # Payment verification + on-chain write
├── src/
│   ├── cli/                    # AgentPassport CLI
│   ├── provider/               # StellarIntel x402 provider (Hono)
│   └── sdk/                    # Contract client helpers
├── web/                        # Next.js dashboard
├── setup.sh                    # One-command hackathon setup
├── .env.demo                   # Pre-configured demo values
└── README.md
```

## What's implemented

- **Soroban contract** — agent registration, verified interactions, relayer-gated writes, post-interaction ratings
- **Worker** — verifies Horizon settlement data and submits interaction registration on-chain
- **StellarIntel provider** — Hono/x402 with one paid `POST /analyze-account` endpoint
- **CLI** — `agent_register`, `agent_query`, `agent_list`, `agent_rate`, `agent_interactions`
- **Dashboard** — Next.js with live leaderboard and agent detail pages
- **Demo script** — exercises the full trust loop on Stellar testnet end-to-end

This is not a mock architecture. The MVP has been exercised on live testnet with real x402 payments, on-chain writes, and ratings.

**Demo contract:** [CCIK4F...U7F](https://stellar.expert/explorer/testnet/contract/CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F)

**Demo provider:** [GC7TRX...LOPT](https://stellar.expert/explorer/testnet/account/GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT)

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) ≥ 20
- npm
- git

### One command

```bash
git clone https://github.com/ggoldani/agent-passport.git
cd agent-passport
chmod +x setup.sh
./setup.sh
```

The script will:
1. Check prerequisites
2. Create `.env` from pre-configured demo values
3. Clone and build [stellar-mcp](https://github.com/ggoldani/stellar-mcp) companion service
4. Install all dependencies
5. Start all services (stellar-mcp, provider, dashboard)
6. Run health checks

Once running:
- **Dashboard:** http://localhost:3000
- **Provider trust profile:** http://localhost:3000/agents/GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT

Run the full demo:

```bash
npm run demo
```

Press `Ctrl+C` to stop all services.

### Manual setup

If you prefer to start each service individually:

```bash
# 1. Clone both repos
git clone https://github.com/ggoldani/agent-passport.git
git clone https://github.com/ggoldani/stellar-mcp.git

# 2. Build stellar-mcp
cd stellar-mcp && npm install && npm run build

# 3. Setup agent-passport
cd ../agent-passport
cp .env.demo .env
npm install
npm --prefix web install

# 4. Start services (3 terminals)

# Terminal A — stellar-mcp
cd ../stellar-mcp
MCP_TRANSPORT=http-sse PORT=3005 STELLAR_NETWORK=testnet npm run start:http

# Terminal B — provider
cd ../agent-passport
set -a && . ./.env && npm run provider

# Terminal C — dashboard
cd ../agent-passport
set -a && . ./.env && npm run dashboard
```

Then run the demo:

```bash
cd agent-passport
set -a && . ./.env && npm run demo
```

## Architecture

**Components:**
- **Soroban contract** — stores provider identity, interactions, and ratings on-chain
- **Worker** — verifies x402 settlement against Horizon, then writes to the contract
- **StellarIntel** — demo provider with one paid endpoint gated by x402
- **Dashboard** — reads live trust data from the contract via RPC
- **[stellar-mcp](https://github.com/ggoldani/stellar-mcp)** — companion service for live Stellar account data

**Flow:** provider registers → consumer checks trust → pays via x402 → worker verifies on-chain → consumer rates → trust profile updates.

**Ecosystem:**
- [Stellar x402](https://www.x402.org)
- Soroban smart contracts

## Roadmap

- [ ] Self-serve provider onboarding
- [ ] Full profile management (`update_agent`)
- [ ] Trust tiers and search/discovery
- [ ] Read-first trust API for integrators
- [ ] Provider analytics
- [ ] Marketplace layer

## Status

Validated MVP — runnable end-to-end on Stellar testnet with real x402 payments, on-chain interaction registration, and live dashboard.
