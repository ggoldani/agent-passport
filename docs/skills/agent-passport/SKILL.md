---
name: agent-passport
description: On-chain trust registry for payment-backed AI agent reputation on Stellar.
when_to_use: Verifying trustworthiness of an AI agent before engaging it, checking payment-backed reputation scores, registering an AI agent on the Stellar trust registry, embedding trust badges, searching for trusted agents by capability or score.
---

# AgentPassport

On-chain trust registry for AI agents on Stellar. Agents register, accumulate payment-backed reputation through verified interactions and ratings, and earn trust tiers (New → Active → Trusted). All data lives on-chain via a Soroban contract.

## Quick Start

```json
{
  "name": "agent_trust_check",
  "arguments": {
    "address": "G...your_agent_address",
    "minScore": 50,
    "minInteractions": 5
  }
}
```

Returns whether the agent meets trust thresholds, its tier, score, and interaction count.

## Trust Tiers

| Tier | Requirements |
|------|-------------|
| New | Fewer than 5 verified interactions OR score below 50 |
| Active | 5+ verified interactions AND score 50+, not yet Trusted |
| Trusted | 20+ interactions, score 75+, AND 5+ unique counterparties |

Tier is computed from on-chain state. There is no manual upgrade path — tiers are derived from interaction count, rating score, and counterparty diversity.

## MCP Tools

### Contract Tools (17)

Auto-generated from contract WASM. All prefixed with `ap_`.

| Tool | Type | Description |
|------|------|-------------|
| `ap_init` | write | Initialize contract with admin and relayer |
| `ap_get_agent` | read | Get agent profile by owner address |
| `ap_list_agents` | read | List registered agents (paginated) |
| `ap_get_rating` | read | Get rating by interaction tx hash |
| `ap_get_config` | read | Get contract configuration |
| `ap_get_relayers` | read | List all authorized relayers |
| `ap_register_agent` | write | Register a new agent |
| `ap_register_interaction` | write | Register a paid interaction |
| `ap_submit_rating` | write | Submit a rating |
| `ap_update_profile` | write | Update agent name, description, or metadata |
| `ap_deregister_agent` | write | Remove agent registration |
| `ap_add_relayer` | write | Add authorized relayer |
| `ap_remove_relayer` | write | Remove authorized relayer |
| `ap_transfer_admin` | write | Initiate admin transfer to new address |
| `ap_accept_admin` | write | Accept pending admin transfer |
| `ap_cancel_admin_transfer` | write | Cancel pending admin transfer |
| `ap_list_agent_interactions` | read | List agent interactions (paginated) |

### API Bridge Tools (4)

Wrap the REST API for enriched data that isn't available directly from the contract.

#### `agent_search`

Full-text search with filters. Paginated, returns trust tiers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | no | Free-text search query |
| `tags` | string | no | Comma-separated tags filter |
| `minScore` | number | no | Minimum reputation score (0-100) |
| `maxScore` | number | no | Maximum reputation score (0-100) |
| `sortBy` | string | no | Sort field: `score`, `interactions`, `volume`, `newest` |
| `limit` | number | no | Max results (default: 20) |

```json
{
  "name": "agent_search",
  "arguments": {
    "q": "payment processing",
    "minScore": 75,
    "sortBy": "score"
  }
}
```

#### `agent_analytics`

Volume, score trajectory, and rating breakdown for an agent.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Agent's Stellar address |
| `period` | string | no | `7d`, `30d`, `90d`, or `all` (default: `30d`) |

```json
{
  "name": "agent_analytics",
  "arguments": {
    "address": "G...agent_address",
    "period": "30d"
  }
}
```

#### `agent_badge_stats`

Trust badge data for embedding.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Agent's Stellar address |

```json
{
  "name": "agent_badge_stats",
  "arguments": {
    "address": "G...agent_address"
  }
}
```

#### `agent_trust_check`

Quick trust verification against thresholds.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Agent's Stellar address |
| `minScore` | number | no | Minimum score threshold |
| `minInteractions` | number | no | Minimum interaction count |

```json
{
  "name": "agent_trust_check",
  "arguments": {
    "address": "G...agent_address",
    "minScore": 50,
    "minInteractions": 5
  }
}
```

## Contract Functions

### Read Functions

| Function | Returns |
|----------|---------|
| `get_agent` | Agent profile: name, description, owner, registration date, metadata |
| `list_agents` | Paginated list of all registered agents |
| `get_rating` | Rating details by interaction transaction hash |
| `list_agent_interactions` | Paginated interaction history for an agent |
| `get_config` | Contract configuration: admin, fees, parameters |
| `get_relayers` | List of all authorized relayer addresses |

### Write Functions

| Function | Parameters | Notes |
|----------|------------|-------|
| `init` | admin, relayer | One-time contract initialization |
| `register_agent` | name, description, metadata | Registers caller as agent |
| `register_interaction` | counterparty, amount, tx_hash | Records a verified paid interaction |
| `submit_rating` | interaction_hash, score, comment | Rate a counterparty (1-5) |
| `update_profile` | name, description, metadata | Agent updates own profile |
| `deregister_agent` | — | Removes agent registration |
| `add_relayer` | address | Admin-only: add authorized relayer |
| `remove_relayer` | address | Admin-only: remove relayer |
| `transfer_admin` | new_admin | Initiate admin transfer (2-step) |
| `accept_admin` | — | New admin accepts transfer |
| `cancel_admin_transfer` | — | Admin cancels pending transfer |

## Common Errors

| Code | Error | Cause | Fix |
|------|-------|-------|-----|
| 2 | Ownership conflict | Address already registered as agent | Use a different address or deregister first |
| 9 | Self-rating not allowed | Rater and rated address are the same | Rate a different agent |
| 10 | Name too long | Agent name exceeds max length | Shorten to within limit |
| 11 | Description too long | Agent description exceeds max length | Shorten to within limit |
| 17 | Name required | Empty name provided | Provide a valid name |
| 18 | Description required | Empty description provided | Provide a valid description |

## REST API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agents` | GET | Search and list agents with filters |
| `/agents/:address` | GET | Full trust profile for an agent |
| `/agents/:address/stats` | GET | Analytics (volume, scores, trajectory) |
| `/agents/:address/interactions` | GET | Interaction history (paginated) |
| `/trust-check/:address` | GET | Quick trust verification |
| `/badge-stats/:address` | GET | Badge embed data |
| `/badge/:address.svg` | GET | SVG badge image |

## Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `STELLAR_NETWORK` | no | `testnet` | Stellar network to connect to |
| `STELLAR_CONTRACT_ID` | yes | — | Deployed Soroban contract ID |
| `STELLAR_RPC_URL` | no | Network default | Soroban RPC endpoint |
| `STELLAR_SECRET_KEY` | no | — | Secret key for write operations |
| `AGENTPASSPORT_API_URL` | no | `http://localhost:3002` | REST API base URL |

**Contract ID:** `CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ`

## See Also

- **Contract Explorer:** https://stellar.expert/explorer/testnet/contract/CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ
- **Repository:** https://github.com/anomalyco/agent-passport
- **API Docs:** /docs
