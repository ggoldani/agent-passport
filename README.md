# AgentPassport

**Payment-backed trust layer for AI agents on Stellar**

AgentPassport lets Stellar agents build a public reputation from real paid interactions, so the ecosystem can move from blind trust to verifiable trust.

## Why this exists

Stellar already has the payment rails for the agent economy: x402, fast settlement, low fees, and smart accounts.

What it still lacks is trust.

An agent can already pay on Stellar. What it cannot reliably answer is:
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
- local dashboard for demo
- minimal provider service (**StellarIntel**) for the end-to-end paid interaction demo

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
├── docs/plans/
├── scripts/
├── src/
├── web/
└── README.md
```

## Supporting demo provider

This repository also includes the spec and eventual implementation for **StellarIntel**, a minimal paid Stellar account intelligence service used only to make the AgentPassport trust flow concrete and demoable.

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

## Ecosystem context

AgentPassport is designed to work alongside the existing Stellar agent/payment stack:
- Stellar x402
- Soroban smart contracts
- OpenZeppelin relayer / x402 facilitator
- `stellar-mcp` as ecosystem infrastructure

## Documentation

Planning and design docs live in `docs/plans/`.

Key files:
- `docs/plans/2026-04-03-agent-passport-design-spec.md`
- `docs/plans/2026-04-03-stellar-intel-provider-spec.md`
- `docs/plans/2026-04-03-agent-passport-storytelling.md`

## Status

Planning/spec phase complete. Implementation not started yet.
