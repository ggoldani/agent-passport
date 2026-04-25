# AgentPassport — Canonical Development Roadmap

**Last updated:** April 23, 2026
**Approach:** Core Loop Completion — each phase delivers a self-contained increment

---

## Guiding Principles

1. **Payment-gated trust is the core.** Ratings exist only after verified x402 payments. Everything builds on this.
2. **Economic history is the trust signal.** Not social reviews, not stake, not attestations alone — verified paid interactions.
3. **Each phase must be independently useful.** No phase depends on a later phase to deliver value.
4. **Contract is stable.** Do not modify the Soroban contract unless a phase explicitly requires it and the tradeoff is clear.
5. **Stellar first, cross-chain later.** Build depth on Stellar before porting to EVM.
6. **Solo builder constraints.** Minimize operational complexity. Prefer embedded databases over managed services. Prefer monorepo simplicity over microservice decomposition. Every running service is a maintenance burden.

---

## Phase 1: Core Loop Completion (DONE)

**Goal:** Make the product usable end-to-end without manual intervention.

**Completed:** April 2026. 19 commits. `tsc --noEmit` zero errors. All commands verified on Stellar testnet.

### 1.1 SDK Publish to npm

**What:** Build pipeline for `src/sdk/` as standalone npm package. Users can `npm install agent-passport-sdk`.

**Why:** External developers cannot use AgentPassport without cloning the repo. The SDK already exists with typed methods and transport abstraction — it needs a build pipeline, entry point, and publish config.

**Delivers:** `npm install agent-passport-sdk` works. SDK is the primary entry point.

**Effort:** Small
**Dependencies:** None
**Files:** `src/sdk/package.json` (exists), `src/sdk/tsconfig.build.json` (exists), build + publish CI

**Success criteria:**
- `npm install agent-passport-sdk` resolves
- `import { AgentPassportClient } from "agent-passport-sdk"` works in a fresh project
- Types are exported correctly (AgentProfile, InteractionRecord, RatingInput, etc.)

### 1.2 Built-in Soroban RPC Transport

**What:** Implement `AgentPassportTransport` using `@stellar/stellar-sdk` Server for simulation-based reads and transaction-based writes. Ship it with the SDK.

**Why:** Current SDK requires users to implement their own transport. Most users just want to query trust profiles — they should not need to understand Soroban simulation. The demo already has this logic (`readContractMethod`, `submitAgentRegistration`, `submitRating`) — extract and generalize it.

**Delivers:** `new AgentPassportClient({ contractId, transport: new SorobanRpcTransport({ rpcUrl, networkPassphrase }) })` works out of the box.

**Effort:** Medium
**Dependencies:** 1.1 (SDK package structure)

**Success criteria:**
- Read methods work via Soroban simulation (getAgent, listAgents, getRating, listAgentInteractions, getConfig)
- Write methods build, sign, and submit transactions (registerAgent, registerInteraction, submitRating)
- Transaction status polling with configurable timeout
- Proper error handling for simulation failures, auth errors, and contract errors

### 1.3 Self-Serve Provider Onboarding

**What:** Wallet-based registration flow. A provider connects their Stellar wallet, signs a message proving ownership, and registers their agent profile on-chain. No relayer involvement for registration.

**Why:** Currently registration requires either the demo script or CLI with manual keypair management. For self-serve, providers need a web-based or CLI-based flow where they control their own keys. The contract's `register_agent` already uses `owner_address.require_auth()` — the provider signs directly.

**Delivers:** A provider can register without contacting the team.

**Effort:** Medium
**Dependencies:** 1.2 (built-in transport for on-chain writes)

**Implementation: CLI-first, then web.**
- Phase 1 ships CLI command: `agent-passport register --name "MyAgent" --description "..." --tags "a,b,c"` (reads secret key from env variable `AGENT_SECRET_KEY`)
- SDK method already exists (`client.registerAgent()`), just needs transport wiring
- Web flow (Freighter/wallet connect) deferred to Phase 3 when dashboard gets upgraded
- Rationale: CLI requires zero new UI infrastructure. The SDK + built-in transport (1.2) already provide everything needed. Web onboarding adds significant frontend work and Freighter integration — not justified until there's enough provider demand.

**Success criteria:**
- Provider can register using only their secret key via CLI (no team assistance)
- Registration appears on-chain and is queryable via SDK/API
- Profile input validation (name required, description required, URL format checks)
- Error handling for already-registered addresses

### 1.4 Enhanced Rating Dimensions

**What:** Extend the rating system with structured tag-based feedback. Instead of a single score, ratings carry dimension tags (quality, speed, reliability, communication). Store off-chain initially, linked to the on-chain interaction tx_hash. The on-chain score remains the single composite for backward compatibility.

**Why:** A single score is information-poor. ERC-8004's tag system (uptime, successRate, responseTime, revenues) shows that structured feedback is more useful for trust decisions. The on-chain contract stores a single score — we enrich this off-chain without contract changes.

**Delivers:** Richer trust data per interaction, queryable via SDK and API.

**Effort:** Medium
**Dependencies:** 1.2 (transport for submitting ratings)

**Design:**
- Off-chain store (initially local JSON/SQLite, later the indexer from Phase 2)
- Schema: `{ interaction_tx_hash, overall_score, dimensions: { quality: 1-5, speed: 1-5, reliability: 1-5, communication: 1-5 }, comment: optional, submitted_at }`
- Linked to on-chain rating via `interaction_tx_hash`
- SDK method: `client.submitRichRating(rating: RichRatingInput)`
- Aggregation: average per dimension, weighted into composite score

**Success criteria:**
- Ratings carry dimension tags stored off-chain
- Dimension averages are queryable alongside the on-chain score
- Backward compatible — existing single-score ratings still work
- Demo script updated to submit rich ratings

### 1.5 CLI Upgrade

**What:** Upgrade CLI to use the published SDK with built-in transport. Add `trust-check` command for quick profile queries.

**Why:** Current CLI is in "prepared" mode for MVP. Make it a real tool that uses the SDK.

**Delivers:** `npx agent-passport trust-check G...` returns a trust profile summary.

**Effort:** Small
**Dependencies:** 1.1, 1.2

**Commands:**
- `trust-check <address>` — query and display trust profile
- `register` — self-serve provider registration
- `rate <tx_hash> --score 90 --quality 5 --speed 4` — submit rating with dimensions
- `list` — list agents with basic filtering
- `interactions <address>` — show interaction history

**Success criteria:**
- All commands work with SDK + built-in transport
- No manual ScVal construction in CLI code
- `trust-check` outputs human-readable trust profile

---

### Phase 1 Dependencies

```
1.1 SDK publish ──→ 1.2 Built-in transport ──→ 1.3 Self-serve onboarding
                  ──→ 1.5 CLI upgrade             │
                                               ──→ 1.4 Enhanced ratings
```

### Phase 1 Success (Gate)

Phase 1 is complete when:
- [x] `npm install agent-passport-sdk` works (build pipeline ready, `npm publish` pending)
- [x] A provider can register, be queried, receive a rating, and have that rating show up — all without team assistance
- [x] Ratings carry structured dimension data
- [x] CLI is a real tool, not a demo helper
- [x] Existing demo flow (`npm run demo`) still passes unchanged

---

## Phase 2: Query Infrastructure (DONE)

**Goal:** Make trust profiles fast to query and accessible via a standard API.

**Completed:** April 2026. 17 commits. `tsc --noEmit` zero errors. Security reviewed (safe). All commands verified on Stellar testnet.

### 2.1 Real-Time Event Indexer

**What:** Listen to Soroban contract events (AgentRegistered, InteractionRegistered, RatingSubmitted). Parse and index into a local store. Expose via query interface.

**Delivered:**
- Drizzle ORM + SQLite indexer with XDR event decoding via `@stellar/stellar-sdk`
- Event classification, address/hash decoding, value field extraction
- Auto-creates tables and indexes on startup
- Transactional event handlers (insert + update in single DB transaction)
- BigInt volume accumulation via stringified `u128` in SQLite
- Historical sync that loops until fully caught up
- Long-running poll mode with configurable interval
- Watermark tracking via ledger metadata for gap-free processing
- Stale watermark recovery (auto-probes RPC oldestLedger on first run)
- Named field access for XDR struct event values (scValToNative returns objects, not arrays)
- Correct Soroban event symbol casing (lowercase snake_case per convention)

**Key files:** `src/indexer/` (schema, connection, events, handlers, indexer, sync, types)

**Effort:** Large (as estimated)

### 2.2 Read-Only Trust API

**What:** Public REST API backed by the indexer.

**Delivered:**
- Hono-based REST API with 7 endpoints:
  - `GET /agents` — list agents with pagination, sorting (score, interactions, volume, created)
  - `GET /agents/:address` — full trust profile
  - `GET /agents/:address/interactions` — interaction history
  - `GET /agents/:address/ratings` — rating history
  - `GET /ratings/:txHash` — rating by transaction hash
  - `GET /search?q=...&tags=...&minScore=...` — search and filter with LIKE queries
  - `GET /health` — health check
- Global rate limiting (300 req/min) plus stricter search limit (60 req/min)
- CORS enabled for browser access
- Shared `formatAgent` utility with safe JSON parsing
- NaN-safe and negative-clamped limit parameters

**Key files:** `src/api/` (server, routes, middleware, types)

**Effort:** Medium (as estimated)

### 2.3 API Key / Rate Limiting

**What:** Simple rate limiting for the trust API.

**Delivered:**
- Token-bucket rate limiter with in-memory bucket storage
- Per-IP bucketing (X-Forwarded-For / X-Real-IP support for reverse proxy deployments)
- Configurable window and max per route
- Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After)
- Automatic bucket cleanup (5-minute TTL)

**Note:** Full API key system (with key generation, validation, and per-key limits) deferred. IP-based rate limiting is sufficient for testnet. API keys will be implemented when third-party integrators need higher limits.

**Key files:** `src/api/middleware/rate-limit.ts`

**Effort:** Small (as estimated)

### 2.4 SDK Transport for Trust API

**What:** SDK transport that hits the read-only API instead of Soroban RPC.

**Delivered:**
- `TrustApiTransport` implements `AgentPassportTransport` interface
- Exhaustive method routing for all read operations
- Proper 404 handling (returns null) vs error propagation (non-OK re-throws)
- Exported from SDK barrel

**Key files:** `src/sdk/api-transport.ts`, `src/sdk/index.ts`

**Effort:** Small (as estimated)

### Additional Deliverables (beyond original plan)

- **Shared env loader** — extracted from CLI to `src/lib/env.ts`
- **Dashboard migration** — API-first with RPC fallback, N+1 eliminated via parallel fetches + Map join
- **Comprehensive reviews** — holistic code review, security review (safe), Web3 security review (medium risk for mainnet, safe for testnet)

---

### Phase 2 Dependencies

```
2.1 Event indexer ──→ 2.2 Trust API ──→ 2.3 Rate limiting
                                   ──→ 2.4 SDK API transport
```

### Phase 2 Success (Gate)

Phase 2 is complete when:
- [x] Trust profile queries return in <100ms via API
- [x] All on-chain state is indexed within seconds
- [x] Third-party apps can integrate with a single HTTP call
- [x] SDK supports both RPC and API transports
- [x] Dashboard uses the API (not direct RPC calls)

---

## Phase 3: Discovery & Scoring (DONE)

**Goal:** Make agents discoverable and trust scores meaningful beyond simple averages.

**Completed:** April 2026. 12 commits. `tsc --noEmit` zero errors. 9/9 tests pass. SDK build clean. Dashboard build clean. E2E verified (all 8 API endpoints). Security reviewed (safe).

### 3.1 Search & Filters

**Delivered:**
- FTS5 full-text search on agent name and description via SQLite triggers (insert/update/delete sync)
- Advanced filters: score range, interaction count range, volume range, tag values (via `json_each`), registration date range, `hasServiceUrl`
- Relevance ranking via `bm25()` with `sortBy=relevance`
- FTS5 query sanitization (strips `"*()` operators, wraps tokens in double quotes)
- Merged into `/agents` endpoint (old `/search` route removed)
- Performance indexes on `score`, `verified_interactions_count`, `created_at`, `interactions.timestamp`, `interactions.consumer_address`

### 3.2 Trust Tier System

**Delivered:**
- `computeTrustTier()` function: New (< 5 interactions or score < 50), Active (default), Trusted (20+ interactions, score 75+, 5+ counterparties)
- `trust_tier` returned on every agent response (API + SDK + dashboard)
- Trust-check API at `/trust-check/:address` with configurable threshold and minInteractions
- Embeddable SVG badge at `/badge/:address.svg` with light/dark themes, 3 sizes, XML-escaped output, 1hr cache
- Trust tier badges on dashboard (inline styles, no shadcn dependency)

### 3.3 Counterparty Endpoint

**Delivered:**
- `/agents/:address/counterparties` with bidirectional aggregation (both provider and consumer directions)
- Per-counterparty: interaction count, total volume, registered agent flag
- Pagination with `limit` param (1-50, default 10)

### 3.4 Rich Ratings in DB

**Delivered:**
- Migrated from `.agent-passport/ratings.json` file store to SQLite `rich_ratings` table
- Schema: interaction_tx_hash, provider_address, consumer_address, score, quality, speed, reliability, communication, comment, submitted_at
- `RichRatingStore` class with `submit()`, `getByInteraction()`, `getByProvider()` methods
- One-time data migration from file to DB (idempotent)
- Schema migration: ALTER TABLE for new columns on existing DBs

### 3.5 Dashboard v2

**Delivered:**
- Tailwind CSS + shadcn/ui (Input, Select) integrated with existing CSS variables (`cssVariables: false`)
- Search bar with 300ms debounce
- Sort filter (score, interactions, volume, newest, relevance)
- Trust tier badges on agent list and detail pages
- Counterparty list on agent detail page
- Server-side rendering with Next.js 15

### 3.6 SDK Updates

**Delivered:**
- `trustCheck()` method on `AgentPassportClient`
- `fetchApi<T>()` added to `AgentPassportTransport` interface
- `TrustApiTransport.fetchApi()` delegates to `fetchJson()`
- `SorobanRpcTransport.fetchApi()` throws (API-only method)
- New types: `TrustCheckOptions`, `TrustCheckResult`

### 3.7 CLI Updates

**Delivered:**
- `trust_verify` command with address validation, configurable threshold and minInteractions, failure reasons

### 3.8 Testing Infrastructure

**Delivered:**
- Vitest framework with globals config, `.worktrees` exclusion
- 9 tests covering trust tier computation

### Deferred (need graph density)

- **AgentRank** (PageRank-style scoring) — needs real interaction graph topology data
- **Multi-signal score composition** — depends on AgentRank
- **Recency decay** — depends on scoring engine; config flag `RECENCY_DECAY_WINDOW_DAYS=0` reserved

---

### Phase 3 Dependencies

```
2.1 Indexer ──→ 3.1 Search & Filters (FTS5)
            ──→ 3.2 Trust Tier
            ──→ 3.3 Counterparty Endpoint
            ──→ 3.4 Rich Ratings in DB
            ──→ 3.5 Dashboard v2 (Tailwind + shadcn)
            ──→ 3.6 SDK Updates
            ──→ 3.7 CLI Updates
            ──→ 3.8 Testing Infrastructure

Deferred: AgentRank → Multi-signal → Recency Decay
```

### Phase 3 Success (Gate)

Phase 3 is complete when:
- [x] Agents can be discovered by name, tags, score range, capability
- [x] Trust tier system is live (New/Active/Trusted)
- [x] Dashboard shows enriched trust data with search and filters
- [x] SDK and CLI support trust verification
- [x] Rich ratings stored in DB (migrated from file)
- [x] Counterparty relationships are queryable
- [ ] AgentRank scores are live and update daily (deferred — needs graph density)
- [ ] Multi-signal composition works with configurable weights (deferred — needs AgentRank)

---

## Phase 4: Analytics & Distribution (DONE)

**Goal:** Mature the trust layer with analytics, distribution tooling, and real financial consequences for reputation.

**Completed:** April 2026. 22 commits. `tsc --noEmit` zero errors. 13/13 tests pass. Full code quality + security review. E2E verified (all 15 endpoints + 3 dashboard pages).

### 4.1 Trust Analytics for Providers

**Delivered:**
- Analytics API endpoint at `/agents/:address/stats` with period filtering (7d/30d/90d/all)
- 5 stat types: volume_over_time, counterparty_growth, score_trajectory, rating_breakdown, summary
- Summary respects period filter (computed from interactions table, not agent.* lifetime fields)
- Dashboard analytics page with Recharts (AreaChart) and period selector
- Stroops-to-XLM conversion on all volume displays (charts + summary)
- Error state, response validation, and period/data decoupling in AnalyticsPanel

**Key files:** `src/api/routes/agents.ts` (stats endpoint), `web/src/components/AnalyticsPanel.tsx`, `web/src/components/analytics/`

### 4.2 Embeddable Widget & Badge

**Delivered:**
- Embeddable JS widget at `/widget.js` (2.7KB, Shadow DOM, zero dependencies)
- Widget renders trust tier badge with stats from `/badge-stats/:address`
- apiUrl validation (http/https only) to prevent SSRF
- Enhanced SVG badge with `stats=full` mode (doubles height, shows volume/interactions/counterparties)
- Badge stats JSON endpoint at `/badge-stats/:address`
- Address validation on badge and badge-stats routes

**Key files:** `src/api/widget.ts`, `src/api/routes/badge.ts`, `src/api/routes/badge-stats.ts`

### 4.3 Priority Rate Limits

**Delivered:**
- Trusted agents (20+ interactions, score 75+, 5+ counterparties) get 2x rate limit multiplier
- Tier cache with 60s TTL to avoid DB hits per request
- Rate limit IP spoofing fix (prefer connection remote addr over client-controllable headers)
- Address validation on priority tier check (Stellar address format)

**Key files:** `src/api/middleware/rate-limit.ts`, `src/api/validate.ts`

### 4.4 SDK Methods

**Delivered:**
- `getAnalytics(address, options)` — returns analytics data with period filter
- `getBadgeStats(address)` — returns badge stats (trust tier, score, volume, etc.)
- New types: `AnalyticsOptions`, `AnalyticsResponse`, `BadgeStatsResponse`

**Key files:** `src/sdk/agent-passport.ts`, `src/sdk/types.ts`

### 4.5 Indexer Backfill

**Delivered:**
- `backfillMissingAgents()` — recovers agents from contract RPC when `agent_registered` events are pruned from testnet retention
- `backfillAgentInteractions()` — recovers interactions via `list_agent_interactions` contract call
- `recalculateAgentStats()` — computes agent counts from interactions table (corrects stale agent.* fields)
- Sync flow: event sync → backfill agents → backfill interactions → recalculate stats
- Fixed sync infinite loop (retry on fetchLatestLedger failure instead of skip)
- Fixed duplicate Server instantiation, oldestLedger undefined guard

**Key files:** `src/indexer/sync.ts`

### 4.6 Dashboard Proxy

**Delivered:**
- Next.js rewrite proxy: `/api/:path*` → `localhost:3002/:path*`
- Enables client-side period filter fetches through same-origin (SSH tunnel compatible)
- `RELAYER_PUBLIC_KEY` env var (dashboard no longer loads secret keys)

**Key files:** `web/next.config.ts`, `web/src/lib/api.ts`

### 4.7 Security Hardening

**Delivered:**
- Stellar address validation (`isValidStellarAddress`) applied to badge, badge-stats, rate limiter
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Global API error handler (sanitized 500 responses)
- Widget SSRF prevention (apiUrl must start with http/https)
- Dashboard uses `RELAYER_PUBLIC_KEY` instead of deriving from `RELAYER_SECRET_KEY`
- Event handler isolation (try-catch per handler, one bad event doesn't kill batch)
- BigInt precision fix (Math.floor for decimals in handlers.ts)
- Rich ratings case mismatch fix (lowercase on insert)

### Deferred

- **Dispute system** — needs real usage data to justify complexity
- **Terms gradient** — Tier 4 (Premier) deferred until AgentRank is live
- **Webhook notifications** — needs event-driven architecture maturity

---

### Phase 4 Dependencies

```
Phase 3 ──→ 4.1 Trust analytics
          ──→ 4.2 Embeddable widget & badge
          ──→ 4.3 Priority rate limits
          ──→ 4.4 SDK methods
Phase 2 ──→ 4.5 Indexer backfill
          ──→ 4.6 Dashboard proxy
All ──→ 4.7 Security hardening
```

### Phase 4 Success (Gate)

Phase 4 is complete when:
- [x] Providers have a full analytics dashboard with period filtering
- [x] Embeddable widget and enhanced badge ship with distribution tooling
- [x] Priority rate limits reward trusted agents
- [x] SDK exposes analytics and badge stats methods
- [x] Indexer recovers from RPC event pruning (backfill)
- [x] Security hardening applied (validation, headers, error handling)
- [ ] Ratings can be contested with evidence (deferred — dispute system)
- [ ] Trust tiers unlock real financial benefits (deferred — terms gradient)
- [ ] Webhooks fire on trust-relevant events (deferred)

---

## Phase 5: Production Readiness & Agent Onboarding

**Goal:** Prepare the product and contract for mainnet deployment. Go from testnet prototype to onboarding real Stellar agents.

### 5.1 Smart Contract Hardening

**What:** Fix all critical and important issues identified in the contract maturity assessment (scored 4/10):
- Admin two-step transfer (`transfer_admin` + `accept_admin`) with 7-day timelock
- Pagination for `list_agents` (from, limit) and `list_agent_interactions` (from_seq, limit)
- Relayer set support (add/remove authorized relayers) via `add_relayer`/`remove_relayer`/`get_relayers`
- Self-interaction rejection (`provider_address == consumer_address`)
- Self-rating rejection (`provider_address == consumer_address`)
- Score floor validation (1-100, reject 0)
- Input validation on all strings — constants: `MAX_NAME_LEN=128`, `MAX_DESC_LEN=512`, `MAX_URL_LEN=256`, `MAX_TAGS=20`, `MAX_TAG_LEN=32`
- `saturating_abs()` for amount overflow protection (i128::MIN edge case)
- `update_profile()` function with auth (name, description, tags, URLs)
- `deregister_agent()` function — removes profile + rating counters, keeps interactions for historical integrity
- Use `env.ledger().timestamp()` instead of caller-provided timestamps
- Replace all `.unwrap()` with proper error codes (24 error codes in `errors.rs`)
- Add doc comments to all 17 public functions
- DRY `validate_profile_input()` shared by `register_agent` and `update_profile`
- Comprehensive test coverage: 57 tests covering all error codes, boundary values, pagination, admin transfer, relayer management, update_profile, deregister
- `ProfileOwners` Vec scalability fix (counter + individual keys + swap-remove pattern)
- `RelayerSet` Vec with counter + swap-remove pattern

**Downstream impact:** Contract API changes (pagination params, new functions) require coordinated updates to:
- `src/indexer/` (sync.ts pagination args, handlers.ts for ProfileUpdated/AgentDeregistered events, transaction wrapping)
- `src/sdk/` (all method signatures, Config type, scval encoding, api-transport pagination)
- `src/api/` (CORS explicit, CSP/HSTS headers, address validation middleware, txHash validation)
- `src/provider/` (CORS configuration)
- `web/src/lib/api.ts` (buildContractArgs pagination, HTTP warning)

**Status:** DONE. April 2026. Contract deployed to testnet: `CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ`. 57/57 tests pass. Zero TypeScript errors. Full code quality review (0 critical). Full security review (0 critical, 0 high). E2E verified on live testnet (6/6 tests).

**Post-fix hardening (applied during review):**
- Security: CORS explicit via `CORS_ORIGINS` env, CSP + HSTS headers, address validation middleware, txHash hex validation, TrustApiTransport HTTPS enforcement, Provider CORS
- SDK: Exported missing types (`AnalyticsOptions`, `AnalyticsResponse`, `BadgeStatsResponse`), fixed api-transport pagination passthrough
- Indexer: Transaction wrapping for batch events, BigInt precision fix (`BigInt(amount)` instead of `BigInt(Math.floor(Number(amount)))`), watermark uses last processed event ledger
- Contract: `deregister_agent` clears `ProviderRatingCount`/`ProviderRatingTotal` (prevents score corruption on re-registration)
- Cleanup: Removed dead `routes/counterparties.ts`

**Why:** Contract had 7 critical issues and 8 important gaps. Mainnet deployment without fixes was irresponsible. This was the #1 blocker for production.

**Delivers:** Contract passes independent security review with zero critical findings. All downstream code updated and tested.

**Verification:** `cargo test` 57 tests pass, `npx tsc --noEmit` zero errors, E2E test 6/6 on live testnet, full code quality + security review.

**Effort:** Large

**Dependencies:** None (contract-only changes)

### 5.2 Self-Service Web Registration

**Status:** DONE. April 2026. 3 commits. `tsc --noEmit` zero errors (root + web). Full code quality review (0 critical). Full security review (0 critical, 0 high). Unit tests 13/13 pass.

**Delivered:**
- **Registration utilities** (`web/src/lib/registration.ts`): form validation, form-to-profile conversion, contract error mapping (25 codes), transaction build+prepare+submit, badge snippet generation with HTTPS enforcement
- **Server component page** (`web/src/app/register/page.tsx`): env-driven config, passes RPC/network/contract to client
- **Client registration form** (`web/src/components/RegistrationForm.tsx`): 6 UI states (idle/connecting/signing/submitting/success/error), dynamic wallet-kit import, createButton await, event cleanup, accessible FieldGroup with id/htmlFor
- **API registration endpoint** (`src/api/routes/register.ts`): POST `/register` accepts signed XDR, validates single-operation register_agent on correct contract, rate limit 10/min, XDR size limit 4096, HTTPS enforcement, generic error messages to client
- **Layout links**: "Register Agent" in topbar + footer, noopener on all external links
- **Dependencies**: `@creit-tech/stellar-wallets-kit@^2.1.0` (JSR), `@stellar/stellar-sdk@^15.0.1`, Next.js bumped to 15.5.15 (DoS fix), protobufjs override >=7.5.5 (RCE fix)

**Transaction flow:** build → prepare → sign (wallet-kit) → submit (web path) or POST signed XDR → validate → submit (API path). Wallet address is source account.

**Key files:** `web/src/lib/registration.ts`, `web/src/app/register/page.tsx`, `web/src/components/RegistrationForm.tsx`, `src/api/routes/register.ts`, `src/api/server.ts`, `web/src/app/layout.tsx`

**Post-implementation hardening (from reviews):**
- Security: XSS in badge snippet fixed (G-address regex + HTTPS URL + quote encoding), arbitrary XDR blocked (single-op verification + XDR size limit), RPC errors sanitized (generic messages), rate limit 10/min, HTTPS enforced for non-local RPC, TDZ crash fixed (isBusy before error block), kitReady guarded on button creation, disconnect resets kitReady, noopener on external links
- Code quality: removed unused imports, regex narrowed to `\b(\d{1,2})\b`, FormInput type extracted, Buffer.from() for safe type conversion, HTTPS-only in buildBadgeSnippet
- Dependencies: protobufjs RCE fixed (override >=7.5.5), Next.js DoS fixed (15.5.15)

**Why:** Self-service registration is the top of the funnel. Without it, no agents can join without team involvement. This unblocks 5.3 (landing page CTA) and proves the wallet-kit integration works for future features.

**Delivers:** Any Stellar agent registers in under 2 minutes through the website.

**Effort:** Medium

**Dependencies:** 5.1 (contract must support `update_profile` for future edits)

### 5.3 Landing Page

**What:** Add a public landing page to the existing Next.js dashboard (`web/`):
- Hero section with value proposition and "Why Stellar" positioning
- Live leaderboard embed (top agents by score)
- How-it-works section (register → interact → build trust)
- Trust tier explanation
- CTA to register (links to registration flow from 5.2)

**Why:** The dashboard is already a working product (agent list, search, filters, detail pages, analytics, counterparty list, widget embed). It just needs a front door. A landing page is the top of the acquisition funnel.

**NOT rebuilding:** Agent detail pages, analytics dashboard, widget docs — these already exist in the current dashboard.

**Delivers:** A public URL that explains AgentPassport and converts visitors into registered agents.

**Effort:** Small-Medium

**Dependencies:** 5.2 (registration page should be linked from landing page CTA)

### 5.4 Onboarding Flow

**Status:** DEFERRED — needs real registration data to measure drop-off. Building onboarding before agents can register is waste. Revisit after 5.2 is live and we have real users.

**Original scope:** Guided post-registration experience (connect wallet → register → get badge → see trust profile → accept x402 payments).

### 5.5 Trust Query Integration via StellarMCP + AI Discovery Skills

**What:** Use stellar-mcp's `stellarmcp-generate` to auto-generate an MCP package from the agent-passport contract WASM. Create SKILL.md files for AI agent discovery (merged from old 5.8).

**Implementation approach:**
- Build contract WASM: `cargo build --release --target wasm32v1-none --manifest-path contracts/agent-passport/Cargo.toml`
- Run `stellarmcp-generate` against the built WASM (from stellar-mcp: `github.com/ggoldani/stellar-mcp`)
- Test generated tools via stellar-mcp's HTTP transport at `localhost:3005/mcp`
- Create SKILL.md files following stellarskills convention (`github.com/ggoldani/stellarskills`) for: trust check flow, registration steps, x402 payment + trust verification
- Optionally: add REST bridge so agent-passport API trust queries (search, analytics, badge-stats) are accessible through MCP

**Why:** Highest-leverage item in Phase 5. Every AI agent on Stellar becomes a potential integrator. MCP tools + SKILL.md files = two discovery mechanisms, one goal. Zero marginal cost per integration.

**Delivers:** Any AI agent can query agent-passport trust data through stellar-mcp. AI agents discover AgentPassport through SKILL.md files.

**Effort:** Small

**Dependencies:** Phase 2 (API), 5.1 (contract pagination changes reflected in WASM)

### 5.6 Testnet → Mainnet Readiness

**Status:** DEFERRED — no testnet users yet. Mainnet costs real money. Revisit after 5.2/5.3 bring real agents to testnet.

**Original scope:** Production runbook, deployment configs, error monitoring, structured logging, G vs C address handling.

**Note:** The current dev relayer (`GDDSDSY...`) is the only authorized relayer. Production requires either (a) a dedicated relayer service operated by the team, or (b) a decentralized relayer network where any authorized party can register interactions. Option (b) is deferred to Phase 6+. Option (a) is operational setup (secret key management, process supervision), not code.

### 5.7 Developer Documentation

**Status:** DEFERRED — no developer demand yet. Write docs when a developer asks "how do I integrate?" Not before.

**Original scope:** Quick start guide, SDK reference, API reference, widget/embed guide, architecture overview.

### 5.8 AgentPassport Skills for AI Discovery

**Status:** MERGED into 5.5 — SKILL.md creation is now part of the StellarMCP integration task. Two features, one goal: make trust data discoverable by AI agents.

---

### Phase 5 Dependencies

```
None ────────────────────→ 5.1 Contract hardening ✅ DONE
5.1 (contract) ──────────→ 5.2 Self-service registration ✅ DONE
5.1 + Phase 2 ──────────→ 5.5 StellarMCP + AI Discovery Skills (independent of 5.2/5.3)
5.2 (registration) ──────→ 5.3 Landing page (CTA links to registration)
5.4 Onboarding ──────────→ DEFERRED (after real users exist)
5.6 Mainnet readiness ───→ DEFERRED (after testnet usage)
5.7 Developer docs ──────→ DEFERRED (after developer demand)
5.8 ─────────────────────→ MERGED into 5.5
```

### Phase 5 Success (Gate)

Phase 5 is complete when:
- [x] Contract has zero critical security findings
- [x] Contract supports pagination, profile updates, relayer set
- [x] Agent registers through website using wallet (no CLI, G and C addresses)
- [ ] Public landing page is live
- [ ] Onboarding flow guides to first action (deferred)
- [ ] Trust queries available through stellar-mcp
- [ ] Mainnet runbook documented (deferred)
- [ ] Developer docs published (deferred)

---

## Phase 6: Growth & Ecosystem (Future)

**Goal:** Scale beyond early adopters. Build network effects and sustainable growth.

**Status:** Not yet planned. Items below are deferred from earlier phases and will be re-evaluated after Phase 5 proves product-market fit.

### Deferred Items (carried forward)

| Item | Status | Original Phase | When to Revisit |
|------|--------|---------------|-----------------|
| ERC-8004 Compatibility Layer | Dropped | Old 5.1 | When EVM agents request Stellar trust data |
| EVM Deployment (Base) | Dropped | Old 5.2 | When a Base ecosystem partner commits to integration |
| Cross-Chain Identity Resolution | Dropped | Old 5.3 | After multi-chain demand exists |
| Reputation Score as On-Chain Feed | Deferred | Old 5.4 | When smart contracts want to consume trust scores as data feeds |
| Composable Attestation Layer | Dropped | Old 5.5 | Phase 10+ at earliest |
| Premium Verification & Curation | Deferred | Old 5.6 | After free tier retention is proven |
| Ecosystem Distribution (MCP, directory) | Deferred | Old 5.7 | Replaced by 5.5 (StellarMCP integration) and 5.8 (AgentPassport skills) |
| Dispute System | Deferred | Phase 4 | When rating volume creates real dispute need. Implementation note: simple `is_revoked` boolean flag on ratings (stellar8004 pattern). Dispute UI/process is the hard part, not the on-chain flag. |
| Trust Terms Gradient (Tier 4 Premier) | Deferred | Phase 4 | When AgentRank is live |
| Webhook Notifications | Deferred | Phase 4 | When agent count justifies event-driven infrastructure |
| AgentRank / Multi-Signal Scoring | Deferred | Phase 3 | When interaction graph has sufficient density. Stepping stone: stellar8004's composite formula (feedback × 0.6 + volume × 0.2) before full PageRank. WAD 18-decimal normalization for precision scoring. |
| **Sybil Resistance Design** | **High Priority** | **Phase 6** | **Dedicated brainstorming session required before implementation. Known Risks section has full analysis.** |
| Recency Decay | Deferred | Phase 3 | When scoring engine is mature |
| Governance / Multi-sig Admin | Deferred | Phase 4 | When team scales beyond solo dev |
| **Sybil Attack Resistance** | **High Priority** | **Phase 5.1** | **Critical trust system vulnerability. See Known Risks below.** |

### Condition for Planning Phase 6

Phase 6 planning begins when:
- 10+ agents registered through self-service flow
- Mainnet contract is deployed and operational
- Organic usage signals exist (API queries, SDK installs, widget embeds)
- Sybil resistance is addressed (minimum interaction value + AgentRank design)

---

## Full Dependency Graph

```
Phase 1: Core Loop Completion (DONE)
├── 1.1 SDK publish → 1.2 Built-in transport → 1.3 Self-serve onboarding
│                                         → → 1.4 Enhanced ratings
│                   → 1.5 CLI upgrade
│
Phase 2: Query Infrastructure (DONE)
├── 2.1 Event indexer → 2.2 Trust API → 2.3 API keys
│                                       → 2.4 SDK API transport
│
Phase 3: Discovery & Scoring (DONE)
├── 3.1-3.8 Search, Trust Tier, Counterparty, Rich Ratings, Dashboard v2, SDK, CLI, Testing
│   (deferred: AgentRank → Multi-signal → Recency Decay)
│
Phase 4: Analytics & Distribution (DONE)
├── 4.1 Trust analytics
├── 4.2 Embeddable widget & badge
├── 4.3 Priority rate limits
├── 4.4 SDK methods
├── 4.5 Indexer backfill
├── 4.6 Dashboard proxy
├── 4.7 Security hardening
│   (deferred: Dispute system, Terms gradient, Webhooks)
│
Phase 5: Production & Onboarding (In Progress)
├── 5.1 Contract hardening ✅ DONE
├── 5.2 Self-service registration ✅ DONE
├── 5.3 Landing page (5.2)
├── 5.4 Onboarding flow — DEFERRED
├── 5.5 StellarMCP + AI Discovery Skills (Phase 2, 5.1)
├── 5.6 Mainnet readiness — DEFERRED
├── 5.7 Developer docs — DEFERRED
├── 5.8 — MERGED into 5.5
│
Phase 6: Growth & Ecosystem (Future, TBD)
├── TBD — planned after Phase 5 product-market fit validation
```

---

## Effort Summary

| Phase | Items | Total Effort | Estimated Time | Status |
|---|---|---|---|---|
| 1. Core Loop Completion | 5 | 2S + 3M | 4-6 weeks | DONE |
| 2. Query Infrastructure | 4 | 1L + 2M + 1S | 6-8 weeks | DONE |
| 3. Discovery & Scoring | 8 | 1L + 4M + 3S | 8-10 weeks | DONE |
| 4. Analytics & Distribution | 7 | 1L + 2M + 1S | 6-8 weeks | DONE |
| 5. Production & Onboarding | 8 | 1L + 4M + 2S-M + 1S | 10-14 weeks | In Progress |
| 6. Growth & Ecosystem | TBD | TBD | TBD | Future |

S = Small (~3-5 days), M = Medium (~1-2 weeks), L = Large (~3-5 weeks)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Soroban RPC rate limits slow indexer | High | Implement backoff, caching, and batched event reads |
| Not enough interaction data for AgentRank | Medium | Phase 3 starts after Phases 1-2 generate real usage data |
| EVM deployment scope creep | High | Strict Phase 5 scoping. Only deploy on Base first. |
| Cross-chain resolution complexity | Medium | Start with API-based resolution, not on-chain bridging |
| Dispute system gaming | Medium | Start with mutual resolution + time-based finality. Stake-weighted voting later. |
| SDK breaking changes | High | Semantic versioning from day one. Transport interface is the stability boundary. |

---

## Data Flow

```
┌─────────────┐     events      ┌──────────────┐     query      ┌──────────────┐
│  Soroban    │ ──────────────→ │   Indexer    │ ─────────────→ │  Trust API   │
│  Contract   │   (AgentRegis-  │  (Drizzle +  │   (REST)       │  (Hono)      │
│  (testnet)  │    tered,       │   SQLite)    │                │              │
│             │    Interaction- │              │                │              │
│             │    Registered,  │              │                │              │
│             │    RatingSub-   │              │                │              │
│             │    mitted,      │              │                │              │
│             │    ProfileUpd-  │              │                │              │
│             │    ated, Agent- │              │                │              │
│             │    Deregistered)│              │                │              │
└─────────────┘                 └──────────────┘                └──────┬───────┘
                                                                        │
                                                         ┌──────────────┼───────────────┐
                                                         │              │               │
                                                         ▼              ▼               ▼
                                                  ┌────────────┐ ┌────────────┐ ┌────────────┐
                                                  │ Dashboard  │ │   SDK      │ │ External   │
                                                  │ (web/)     │ │ (TrustApi- │ │ apps       │
                                                  │            │ │ Transport) │ │ (HTTP)     │
                                                  └────────────┘ └────────────┘ └────────────┘
```

**On-chain vs. off-chain state:**
- On-chain (Soroban): agent profiles, interaction records, rating scores, config. Source of truth.
- Off-chain (indexer): enriched views, dimension ratings, search index, AgentRank scores, dispute data. Derived from on-chain events + off-chain submissions.
- The indexer is a materialized view of on-chain state. It can always be rebuilt from events.

## Known Risks

### Sybil Attack on Trust System (HIGH CRITICALITY)

The trust system is vulnerable to sybil attacks: an attacker creates N fake agent addresses (free on Stellar), uses x402 payments (~$0.001 each) to generate verified interactions between them, and manufactures high trust scores with minimal cost.

**Why this matters:** A trust system that can be gamed has no trust. If agent scores can be fabricated for pennies, the entire product's value proposition collapses.

**Current defenses (insufficient):**
- Self-interaction/rating blocks — bypassed with 2+ fake agents cross-interacting
- Trusted tier requires 5+ counterparties — bypassed by creating 6+ fake agents
- x402 payment verification — cost is negligible (~$0.001 per interaction)

**Design constraints (from analysis):**
- Minimum interaction value DISCARDS real micro-payments — conflicts with x402 philosophy (penny interactions are real). NOT acceptable.
- Counterparty concentration penalty bypassable with enough fake agents (10+ addresses, all interacting). Useful signal but not a defense alone.
- AgentRank as sole defense is insufficient — real edges into fake clusters leak PageRank. Good as ranking supplement, bad as foundation.
- Decentralized sybil resistance is an unsolved problem — no purely on-chain solution exists. Every system trades off some decentralization or accessibility.

**Proposed approach: defense-in-depth with red/yellow flags, not gates**

Instead of trying to be impenetrable (which means excluding real users), make attacks detectable and transparent:

1. **Counterparty concentration score** — expose a metric showing what % of an agent's interactions are with the same agents. High concentration = yellow/red flag. Does NOT discard any interaction — all x402 payments are recorded and counted.

2. **Account age/trust trajectory** — new accounts start with "unproven" status. Trust builds over time regardless of score. Old accounts with long history are inherently more trustworthy.

3. **Cluster detection** — identify groups of agents that only interact within themselves. Mark them with a "low network diversity" flag. Visible to anyone evaluating trust.

4. **AgentRank (supplement)** — used for discovery ranking, not as primary sybil defense. Agents well-connected to the broader network rank higher in search results.

5. **Minimum interaction value** — NOT for trust scoring (keeps all x402 interactions). Instead: only interactions above a threshold (e.g., 1 XLM) contribute to the AgentRank computation. This raises the cost of gaming PageRank without discarding real data.

**Key principle:** Don't exclude real interactions. Don't gate trust behind minimum amounts. Instead, make manipulation VISIBLE through metadata that any trust evaluator can audit.

**Dedicated brainstorming session needed:** This is a design problem, not an implementation problem. Requires research into: EigenTrust, PageRank variants, Web of Trust, Gitcoin scoring, graph anomaly detection, and economic game theory. Schedule a dedicated brainstorming + spec session before Phase 6.

**Phase 6 condition update:** Phase 6 planning should also require demonstrated sybil attack attempts or security audit of trust scoring, not just organic usage metrics.

---

## Deployment (Solo Builder)

| Component | Development | Production |
|---|---|---|
| Indexer | Local process, SQLite | Single VPS, SQLite (upgrade to Postgres if needed) |
| Trust API | Local process (tsx) | Same VPS as indexer, reverse proxy (Caddy) |
| Dashboard | `npm run dev` | Vercel (free tier) or same VPS |
| Provider | Local process (demo) | Not deployed — demo-only |
| SDK | npm publish via CI | npm registry |

**Target:** One $10-20/month VPS runs indexer + API + dashboard behind Caddy. SQLite handles the load easily at this scale.

---

## SDK Versioning Strategy

- Semantic versioning from first npm publish.
- Transport interface (`AgentPassportTransport`) is the stability boundary — it will not change in breaking ways within a major version.
- Types (`AgentProfile`, `InteractionRecord`, etc.) are the public API contract — new fields are added as optional, never removed without a major version bump.
- New transport implementations (TrustApiTransport, future BaseTransport) are additive.
- `CHANGELOG.md` maintained in the SDK package.

---

## What NOT to Build (YAGNI)

Explicitly excluded from all phases:

| Item | Why Not |
|---|---|
| Token / tokenomics | No need for a token. Economic trust comes from x402 payments, not staking. |
| Staking / slashing | Payment-gating already provides Sybil resistance. Staking adds complexity without proportional benefit. |
| NFT-based agent identity | x84 does this on Solana. AgentPassport uses address-based identity. NFTs add UX complexity. |
| Agent-to-agent messaging | SAID and RELAY do this. AgentPassport is a trust layer, not a communication layer. |
| Marketplace / service execution | AgentPassport provides trust data for marketplaces to consume. It is not a marketplace. |
| LLM integration in scoring | Deterministic scoring (AgentRank + multi-signal) is transparent and auditable. LLM scoring is a black box. |
| Mobile app | Dashboard is web-based. No mobile-specific work until clear demand. |
| Multi-sig provider identity | The contract uses `owner_address.require_auth()`. Multi-sig can be handled at the wallet level. |
| Governance / DAO | Solo-built project. No governance infrastructure needed. |
| Decentralized indexer | Single indexer is fine. Decentralized indexing adds massive complexity. |

If any of these become clearly needed during a phase, they can be added to a future phase. But they are not planned.

---

## Known Limitations (from Web3 Security Review, Phase 2)

These are architectural items identified during the Phase 2 Web3 security review. They are not bugs — they are design decisions for future phases. Documented here for tracking.

| # | Finding | Severity | Phase to Address |
|---|---------|----------|------------------|
| 1 | Relayer can fabricate interactions (single relayer is sole oracle) | High | **Resolved in Phase 5.1** (relayer set — admin can add/remove multiple relayers) |
| 2 | No on-chain payment verification for tx_hash/amount | High | Future (payment proof system) |
| 3 | Score=0 accepted (contract only checks >100) | High | **Resolved in Phase 5.1** (score floor 1-100) |
| 4 | X-Forwarded-For spoofing bypasses rate limits | Medium | Fixed in Phase 4 |
| 5 | Indexer uses private `_getEvents` API | Medium | When stellar-sdk exposes public API |
| 6 | No URL validation on agent URLs in contract | Medium | **Resolved in Phase 5.1** (MAX_URL_LEN=256 input validation) |
| 7 | Off-chain indexer score can diverge from on-chain | Medium | Resolved in Phase 4 (use on-chain score) |
| 8 | `unsigned_abs()` silently converts negative amounts | High | **Resolved in Phase 5.1** (saturating_abs) |
| 9 | Unbounded on-chain reads (list_agents, list_agent_interactions) | High | **Resolved in Phase 5.1** (pagination with MAX_PAGE_SIZE=100) |
| 10 | Event field order dependency in indexer | Low | Resolved in Phase 3 (named field decoding) |
| 11 | Admin lock-in — no transfer/accept pattern | High | **Resolved in Phase 5.1** (two-step admin transfer with 7-day timelock) |
| 12 | Self-rating allowed (provider == consumer) | High | **Resolved in Phase 5.1** (self-rating rejection + self-interaction rejection) |
| 13 | No input validation on string lengths in contract | High | **Resolved in Phase 5.1** (max length constants + validate_profile_input) |
| 14 | No profile update or deregister function | Medium | **Resolved in Phase 5.1** (update_profile, deregister_agent) |
| 15 | Arbitrary timestamps in interactions | Medium | **Resolved in Phase 5.1** (use ledger timestamp) |
| 16 | i128::MIN overflow via unsigned_abs | Critical | **Resolved in Phase 5.1** (saturating_abs) |

---

## Open Questions

These require real usage data or ecosystem developments to answer. Decisions deferred until the relevant phase.

| Question | When to Decide | What Data Is Needed |
|---|---|---|
| AgentRank damping factor (0.85 vs other values) | Phase 6+ | Real interaction graph topology — how connected is it? |
| Default multi-signal weights | Phase 6+ | User feedback on which signals matter most for trust decisions |
| Rating dimension set (quality, speed, reliability, communication — keep all? add more?) | Phase 1 | Provider/consumer feedback on which dimensions are useful |
| Dispute review model (operator vs community) | Phase 6+ | Dispute volume — if <5/month, manual is fine |
| Base deployment priority vs other EVM chains | Phase 6+ | EVM agent activity data — is Base still dominant? |
| SDK transport default (RPC vs API) | Phase 2 | Latency and reliability data for both transports |
| Rich rating storage in Phase 1 (JSON vs SQLite) | Phase 1 | Resolved — migrated to SQLite in Phase 3 |
| Relayer model (set vs proof-based vs multi-sig) | Phase 5.1 | Security review of current single-relayer architecture |
| Contract upgrade mechanism (migrate vs upgradeable wrapper) | Phase 5.1 | **Resolved in Phase 5.1** — full contract rewrite deployed as new instance (`CAYIR5ON...`). Old contract (`CCIK4FM...`) preserved for reference. Upgrade mechanism deferred until post-mainnet. |

---

## Technical Debt (Phase 5.1 Review)

Items identified during post-fix code quality and security reviews. Status after Phase 5.1 hardening sprint.

| # | Item | Severity | Status | When to Fix |
|---|------|----------|--------|-------------|
| 1 | FTS5 `trust_tier` added to CREATE TABLE inline; ALTER TABLE migration removed | High | **Fixed** | — |
| 2 | `db: any` typing replaced with `BetterSQLite3Database<typeof schema>` in server.ts + all route files | Medium | **Fixed** | — |
| 3 | Rate limiting uses in-memory Map — resets on restart, doesn't scale to multiple instances | Medium | Remaining | Mainnet (consider Redis) |
| 4 | `trust_tier` added to Drizzle schema, synced with raw SQL DDL | Medium | **Fixed** | — |
| 5 | Dual schema definition — raw SQL DDL + Drizzle ORM independently, drift risk | Medium | Partially fixed | Phase 5.6 (pick one) |
| 6 | `submitRichRating` returns client-side timestamp, not on-chain ledger timestamp | Medium | Remaining | When rich ratings are used in production |
| 7 | Web error boundary (`error.tsx`) and 404 page (`not-found.tsx`) added | Medium | **Fixed** | — |
| 8 | Score thresholds synced (80/40) across all UI components | Low | **Fixed** | — |
| 9 | `searchParams` cast replaced with safe loop handling `string[]` values | Low | **Fixed** | — |
| 10 | Web API throws (not warns) on HTTP in non-localhost production | Low | **Fixed** | — |
| 11 | CORS defaults to restrictive (same-origin only) when env var unset | Low | **Fixed** | — |
| 12 | Indexer `poll()` event processing wrapped in `db.transaction()` | Low | **Fixed** | — |
| 13 | `recalculateAgentStats` uses `CAST(amount AS INTEGER)` instead of `REAL` | Low | **Fixed** | — |
| 14 | Relayer removal uses O(n) linear scan (no reverse index like profile owners) | Low | Remaining | Never (relayer set is small) |
