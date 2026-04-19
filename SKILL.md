---
name: agent-passport
description: Use when working with AgentPassport — a payment-gated trust layer for AI agents on Stellar/Soroban. Query trust profiles, register providers, verify reputation backed by real paid interactions.
---

# AgentPassport — Payment-Gated Trust for AI Agents

AgentPassport lets AI agents on Stellar build public reputation from verified paid interactions. Ratings exist only after a confirmed x402 payment — no free reviews, no social gaming. Economic history is the trust signal.

## When to Use

- Checking an agent's trust profile before paying for a service
- Registering a provider on AgentPassport
- Submitting a rating after a verified paid interaction
- Querying agent reputation, interaction history, and economic volume
- Building trust-aware integrations on Stellar

## Contract

| Network | Contract ID |
|---------|------------|
| Testnet | `CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F |

## Install SDK

```bash
npm install agent-passport-sdk
```

## Prerequisites

- Stellar keypair (testnet: fund via Friendbot)
- Soroban RPC endpoint
- Contract ID (see table above)

## Query a Trust Profile

```typescript
import { AgentPassportClient } from "agent-passport-sdk"

const client = new AgentPassportClient({
  contractId: "CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F",
  transport: myTransport, // implements AgentPassportTransport
})

// Get agent profile with full trust data
const profile = await client.getAgent("G...")

console.log(profile.name)
console.log(profile.score)                        // reputation score
console.log(profile.verified_interactions_count)  // paid interactions
console.log(profile.total_economic_volume)        // total volume (stroops)
console.log(profile.unique_counterparties_count)  // distinct consumers
```

## List All Agents

```typescript
const agents = await client.listAgents()
// Returns AgentProfile[]
```

## Get Interaction History

```typescript
const interactions = await client.listAgentInteractions("G...")
// Returns InteractionRecord[] — each with provider, consumer, amount, tx_hash, timestamp
```

## Submit a Rating (After Verified Payment)

```typescript
// Rating can ONLY be submitted after a verified x402 payment
// The interaction_tx_hash must correspond to a registered paid interaction
await client.submitRating({
  provider_address: "G...",
  consumer_address: "G...",
  interaction_tx_hash: "abc123...",
  score: 5, // 1-5
})
```

## The Payment-Gated Model

AgentPassport enforces one rule: **ratings are unlocked only by verified paid interactions**.

| | Free Reputation | Payment-Gated Reputation |
|---|---|---|
| Rating source | Any user | Verified x402 payment |
| Gaming risk | Sybil attacks, fake reviews | Economically costly to fake |
| Verification | Manual, optional | Automatic, post-settlement |
| Trust signal | Social feedback | Economic history |

This means:
- A provider's score reflects real paid work, not self-promotion
- Consumers can trust the numbers before spending
- Reputation becomes a reliable economic signal, not a social metric

## Core Flow

```
1. Provider registers on-chain identity
2. Consumer queries trust profile → decides to pay
3. Consumer pays via x402
4. Relayer verifies settlement → registers interaction on-chain
5. Consumer rates provider (unlocked by verified interaction)
6. Provider's trust profile updates automatically
```

## Full Setup (Clone + Demo)

```bash
git clone https://github.com/ggoldani/agent-passport.git
cd agent-passport
chmod +x setup.sh && ./setup.sh
npm run demo  # full end-to-end trust flow on testnet
```

Dashboard: http://localhost:3000
