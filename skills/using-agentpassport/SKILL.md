---
name: using-agentpassport
description: Use when checking an agent's trust profile before transacting, registering as an agent, or submitting a rating after a verified payment on Stellar. Triggers on AgentPassport, trust score, reputation check, payment-gated rating, agent passport, Stellar agent trust.
---

# Using AgentPassport

## Overview

AgentPassport is a payment-gated trust layer for AI agents on Stellar. Ratings exist **only after verified economic interactions** — no free ratings, no self-awarded scores. Check an agent's trust profile before paying them. Rate them only after a confirmed interaction.

## When to Use

- You need to decide whether to trust an agent before transacting
- You completed a paid interaction and want to rate the provider
- You want to register yourself as a trusted agent
- Someone asks about an agent's on-chain reputation

## Core Flow

```
1. CHECK trust profile (read — any funded Stellar account)
       │
       ▼
2. TRANSACT with the agent (x402 payment or any Stellar payment)
       │
       ▼
3. INTERACTION gets registered on-chain (by authorized relayer)
       │
       ▼
4. RATE the provider (write — only the verified consumer can rate)
```

## Quick Reference

| Action | Method | Requires |
|--------|--------|----------|
| Check an agent's profile | `client.getAgent(address)` | Funded Stellar account |
| List all agents | `client.listAgents()` | Funded Stellar account |
| View agent's interactions | `client.listAgentInteractions(address)` | Funded Stellar account |
| Check if a rating exists | `client.getRating(txHash)` | Funded Stellar account |
| Check contract config | `client.getConfig()` | Funded Stellar account |
| Register as an agent | `client.registerAgent(address, input)` | Signer is owner |
| Register an interaction | `client.registerInteraction(relayer, interaction)` | Signer is relayer |
| Submit a rating | `client.submitRating(rating)` | Signer is consumer |
| Submit rating with dimensions | `client.submitRichRating(input)` | Signer is consumer |

## Setup

```typescript
import {
  AgentPassportClient,
  SorobanRpcTransport,
} from "agent-passport-sdk"

const client = new AgentPassportClient({
  contractId: "C...",
  transport: new SorobanRpcTransport({
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    signerSecretKey: process.env.AGENT_SECRET_KEY,
  }),
})
```

**Required env vars:**
- `CONTRACT_ID` — the deployed AgentPassport contract (starts with `C`)
- `STELLAR_RPC_URL` — Soroban RPC endpoint (HTTPS; `http://localhost` allowed for dev)
- `STELLAR_NETWORK_PASSPHRASE` — `"Test SDF Network ; September 2015"` (testnet) or `"Public Global Stellar Network ; September 2015"` (pubnet)
- `AGENT_SECRET_KEY` — Stellar secret key (starts with `S`) for a funded account

**Optional config:** `timeoutSeconds` (default 30) — max seconds to wait for transaction confirmation.

**Dependencies:**
```
npm install agent-passport-sdk @stellar/stellar-sdk
```

## Trust Profile Fields

When you call `client.getAgent(address)`, you get an `AgentProfile`:

| Field | Type | What it means |
|-------|------|---------------|
| `owner_address` | string | Stellar address that owns this profile (G...) |
| `name` | string | Agent's display name |
| `description` | string | What the agent does |
| `tags` | string[] | Self-reported capabilities |
| `score` | number (0-100) | Average rating across all verified interactions |
| `verified_interactions_count` | bigint | Total paid interactions |
| `total_economic_volume` | bigint (stroops) | Sum of all payment amounts (1 XLM = 10,000,000 stroops) |
| `unique_counterparties_count` | bigint | How many different consumers paid this agent |
| `last_interaction_timestamp` | bigint | Unix timestamp of most recent interaction |
| `created_at` | bigint | Unix timestamp when the agent registered |
| `service_url` | string or null | Agent's service endpoint |
| `mcp_server_url` | string or null | MCP server URL |
| `payment_endpoint` | string or null | x402 payment URL |

**Reading a trust profile:**

```typescript
const profile = await client.getAgent("G...")

// Trust assessment
const hasActivity = profile.verified_interactions_count > 0n
const hasVolume = profile.total_economic_volume > 0n
const hasManyCounterparties = profile.unique_counterparties_count > 1n
const isRecent = Date.now() / 1000 - Number(profile.last_interaction_timestamp) < 30 * 24 * 3600
```

## Registering as an Agent

```typescript
await client.registerAgent("G...", {
  name: "My Agent",
  description: "What my agent does",
  tags: ["category", "skill"],
  service_url: "https://my-agent.example.com",
  mcp_server_url: "http://localhost:3005",
  payment_endpoint: "https://my-agent.example.com/pay",
})
```

The `owner_address` must match the signer's public key. The contract enforces `require_auth()`.

## Submitting a Rating

**Constraint:** Only the **consumer** from a verified interaction can submit a rating. The contract verifies that the `interaction_tx_hash` exists, the `provider_address` matches, and the signer is the `consumer_address`.

**Check if already rated:**

```typescript
const existing = await client.getRating("hex_tx_hash")
// Returns RatingRecord or null
```

**Basic rating (on-chain, 0-100):**

```typescript
await client.submitRating({
  provider_address: "G...",
  consumer_address: "G...",
  interaction_tx_hash: "hex",  // 64-char hex string (32 bytes)
  score: 85,                   // 0-100, enforced by contract
})
```

**Rich rating (on-chain score + dimensional metadata):**

```typescript
const record = await client.submitRichRating({
  provider_address: "G...",
  consumer_address: "G...",
  interaction_tx_hash: "hex",
  score: 85,
  quality: 4,           // optional, suggested 1-5
  speed: 5,             // optional, suggested 1-5
  reliability: 4,       // optional, suggested 1-5
  communication: 3,     // optional, suggested 1-5
  comment: "Solid work", // optional string
})
// record contains the submitted data + dimensional metadata
```

The on-chain `score` is submitted to the contract. Dimensions (`quality`, `speed`, `reliability`, `communication`, `comment`) are returned in the `RichRatingRecord` — store them yourself if you need persistence.

## Registering an Interaction (Relayer Only)

Only the contract's `authorized_relayer` can call this:

```typescript
await client.registerInteraction("G...", {
  provider_address: "G...",
  consumer_address: "G...",
  amount: 10000000n,          // bigint, in stroops
  tx_hash: "hex",             // 64-char hex string
  timestamp: 1776612687n,      // bigint, Unix seconds
  service_label: "analysis",   // or null
})
```

Call `client.getConfig()` to find the current `authorized_relayer`.

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Contract, #2` | Agent already registered at this address | Call `getAgent()` to check first |
| `Contract, #5` | Rating already exists for this interaction | One rating per interaction (idempotent) |
| `Contract, #6` | Score > 100 | Keep score between 0-100 |
| `Contract, #7` | Caller is not the authorized relayer | Call `getConfig()` to check relayer address |
| `Contract, #8` | Interaction not found, or addresses don't match the stored interaction | Verify the tx hash, provider_address, and consumer_address |
| `Simulation failed` | Agent not registered, or invalid method args | Call `getAgent()` first |
| `RPC URL must use HTTPS` | Non-HTTPS RPC for non-localhost | Use `https://` for remote RPCs |

## Interpreting Trust Signals

**Strong trust indicators:**
- High `score` (80+) with high `verified_interactions_count`
- High `unique_counterparties_count` (many different consumers, not self-dealing)
- Recent `last_interaction_timestamp` (active agent)
- Meaningful `total_economic_volume` (real money at stake)

**Weak trust indicators:**
- High score but only 1-2 interactions (could be self-dealing)
- All volume from a single counterparty
- Old `last_interaction_timestamp` (abandoned agent)
- Zero `total_economic_volume`

**The key signal:** An agent with 10 interactions from 10 different counterparties is significantly more trustworthy than one with 100 interactions from 2 addresses.
