# Phase 5.5: StellarMCP + AI Discovery Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an MCP server with 22 tools (18 contract + 4 REST API bridge) and a SKILL.md file for AI agent discovery.

**Architecture:** Use `stellarmcp-generate` to auto-generate MCP tools from the contract WASM, then add custom tools wrapping the REST API (search, analytics, badges, trust-check). Write a comprehensive SKILL.md following the stellarskills convention. Everything lives in the agent-passport repo.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@ggoldani/stellarmcp` (generator), Node.js stdio MCP transport

**Spec:** `docs/superpowers/specs/2026-04-30-phase55-stellarmcp-discovery-design.md`

---

## File Structure

```
tools/agent-passport-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # MCP server entry point (registers all tools)
│   ├── generated/                  # stellarmcp-generate output (contract tools)
│   │   ├── tools/                  # auto-generated Zod schemas + handlers
│   │   └── index.ts                # tool registration export
│   └── api-bridge/                 # custom REST API tools
│       ├── search.ts               # agent_search tool
│       ├── analytics.ts            # agent_analytics tool
│       ├── badge.ts                # agent_badge_stats tool
│       ├── trust-check.ts          # agent_trust_check tool
│       ├── client.ts               # shared fetch helper + validation
│       └── index.ts                # bridge tool registration export
└── README.md

docs/skills/agent-passport/
└── SKILL.md                        # comprehensive skill file for AI agents
```

---

### Task 1: Install dependencies and scaffold MCP package

**Files:**
- Create: `tools/agent-passport-mcp/package.json`
- Create: `tools/agent-passport-mcp/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "agent-passport-mcp",
  "version": "0.1.0",
  "description": "MCP server for AgentPassport trust registry — 18 contract tools + 4 REST API bridge tools",
  "type": "module",
  "main": "build/src/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node build/src/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "build",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd tools/agent-passport-mcp && npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 4: Create minimal entry point**

Create `src/index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "agent-passport",
  version: "0.1.0",
});

server.tool("health", "Check MCP server status", {}, async () => ({
  content: [{ type: "text", text: "AgentPassport MCP server is running" }],
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 5: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run build`
Expected: `build/src/index.js` created, no errors

- [ ] **Step 6: Verify MCP server starts**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 5 node build/src/index.js 2>/dev/null || true`
Expected: JSON-RPC response with server info

- [ ] **Step 7: Commit**

```bash
git add tools/agent-passport-mcp/
git commit -m "feat(mcp): scaffold MCP package with minimal entry point"
```

---

### Task 2: Generator spike — run stellarmcp-generate and verify output

**Files:**
- Read: `contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm`
- Create: `tools/agent-passport-mcp/src/generated/` (output from generator)

- [ ] **Step 1: Install stellar-mcp CLI**

Run: `npm install -g @ggoldani/stellarmcp 2>/dev/null || npm install -g stellarmcp 2>/dev/null`
If global install fails, install locally:
```bash
cd tools/agent-passport-mcp && npm install --save-dev @ggoldani/stellarmcp
```

- [ ] **Step 2: Run generator against contract WASM**

Run:
```bash
cd tools/agent-passport-mcp
npx stellarmcp-generate --input ../../contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm --out ./generated-output --name agent-passport-mcp --alias ap
```

Expected: Output directory created with generated MCP server code

- [ ] **Step 3: Inspect generated output**

Run: `find ./generated-output -type f -name "*.ts" | head -20`
Document: file structure, tool names, parameter schemas, how tools are registered

- [ ] **Step 4: Verify tool count and names**

Run: `grep -r "server.tool\|server.tool(" ./generated-output/src/ 2>/dev/null | wc -l`
Expected: 18 tool registrations (all contract functions except `init`)

Check tool names: `grep -oP 'server\.tool\("\K[^"]+' ./generated-output/src/ -r 2>/dev/null`
Document: actual tool names (may be prefixed like `ap_register_agent` or unprefixed like `register_agent`)

- [ ] **Step 5: Verify generated server builds**

Run: `cd generated-output && npm install && npm run build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 6: Clean up spike output**

Run: `rm -rf ./generated-output`
We only needed to verify the generator works and understand its output format.

- [ ] **Step 7: Document findings and adapt plan**

Based on the spike results, update these variables for Task 3:
- `GENERATED_TOOL_NAMES`: actual tool names from step 4
- `GENERATED_STRUCTURE`: actual file structure from step 3
- `GENERATED_REGISTRATION_PATTERN`: how tools are registered (import pattern, function signature)

If the generator output differs from what's assumed in this plan, adjust Task 3 accordingly.

- [ ] **Step 8: Commit spike documentation**

```bash
echo "# Generator Spike Results

## Tool Names
[paste from step 4]

## File Structure
[paste from step 3]

## Registration Pattern
[describe how tools are registered]" > tools/agent-passport-mcp/SPIKE.md
git add tools/agent-passport-mcp/SPIKE.md
git commit -m "docs(mcp): document generator spike results"
```

---

### Task 3: Generate contract tools and integrate with MCP server

**Files:**
- Modify: `tools/agent-passport-mcp/package.json` (add stellarmcp dev dependency)
- Modify: `tools/agent-passport-mcp/src/index.ts` (import and register generated tools)
- Create: `tools/agent-passport-mcp/src/generated/` (generated output, committed)

This task depends on Task 2 spike results. Adapt the steps based on documented findings.

- [ ] **Step 1: Generate contract tools into final location**

Run:
```bash
cd tools/agent-passport-mcp
npx stellarmcp-generate --input ../../contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm --out src/generated --name agent-passport-contract --alias ap
```

- [ ] **Step 2: Install and build generated code**

Run: `cd tools/agent-passport-mcp && npm install && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Update index.ts to import generated tools**

The exact import depends on spike results (Task 2). Likely pattern:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import generated contract tools
import { registerContractTools } from "./generated/index.js";

const NETWORK = process.env.STELLAR_NETWORK || "testnet";
const CONTRACT_ID = process.env.STELLAR_CONTRACT_ID;
const RPC_URL = process.env.STELLAR_RPC_URL;

if (!CONTRACT_ID) {
  console.error("STELLAR_CONTRACT_ID env var is required");
  process.exit(1);
}

const server = new McpServer({
  name: "agent-passport",
  version: "0.1.0",
});

// Register generated contract tools
registerContractTools(server, { network: NETWORK, contractId: CONTRACT_ID, rpcUrl: RPC_URL });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

Note: The exact `registerContractTools` function signature depends on what the generator exports. Adapt based on Task 2 spike results.

- [ ] **Step 4: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run build`
Expected: No errors

- [ ] **Step 5: Verify contract tools are registered**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 STELLAR_CONTRACT_ID=CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ node build/src/index.js 2>/dev/null | python3 -m json.tool | grep -c '"name"'
```
Expected: 18+ tool names listed

- [ ] **Step 6: Commit**

```bash
git add tools/agent-passport-mcp/
git commit -m "feat(mcp): generate and integrate 18 contract tools from WASM"
```

---

### Task 4: Create API bridge — shared client and validation

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/client.ts`

- [ ] **Step 1: Create shared API client**

```typescript
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_RE.test(address);
}

export function getApiUrl(): string {
  const url = process.env.AGENTPASSPORT_API_URL || "http://localhost:3002";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`Invalid AGENTPASSPORT_API_URL: ${url}. Must start with http:// or https://`);
  }
  return url.replace(/\/+$/, "");
}

export async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text().catch(() => "unknown error");
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `AgentPassport API unreachable at ${baseUrl}. Start the API server or set AGENTPASSPORT_API_URL.`
      );
    }
    throw error;
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tools/agent-passport-mcp/src/api-bridge/client.ts
git commit -m "feat(mcp): add shared API client with validation and error handling"
```

---

### Task 5: Create API bridge — agent_search tool

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/search.ts`

- [ ] **Step 1: Create search tool**

```typescript
import { z } from "zod";
import { apiFetch } from "./client.js";

export const searchSchema = z.object({
  q: z.string().optional().describe("Full-text search query"),
  tags: z.string().optional().describe("Comma-separated tags to filter"),
  minScore: z.number().int().min(0).max(100).optional().describe("Minimum score filter"),
  maxScore: z.number().int().min(0).max(100).optional().describe("Maximum score filter"),
  sortBy: z.enum(["score", "interactions", "volume", "newest", "relevance"]).optional().describe("Sort field"),
  limit: z.number().int().min(1).max(50).optional().describe("Results per page (1-50)"),
});

export type SearchParams = z.infer<typeof searchSchema>;

interface AgentResponse {
  owner_address: string;
  name: string;
  description: string;
  tags: string;
  score: number;
  verified_interactions_count: number;
  trust_tier: string;
}

interface PaginatedResponse {
  data: AgentResponse[];
  total: number;
  has_more: boolean;
}

export async function agentSearch(params: SearchParams): Promise<PaginatedResponse> {
  const query: Record<string, string> = {};
  if (params.q) query.q = params.q;
  if (params.tags) query.tags = params.tags;
  if (params.minScore !== undefined) query.minScore = String(params.minScore);
  if (params.maxScore !== undefined) query.maxScore = String(params.maxScore);
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.limit !== undefined) query.limit = String(params.limit);

  return apiFetch<PaginatedResponse>("/agents", query);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tools/agent-passport-mcp/src/api-bridge/search.ts
git commit -m "feat(mcp): add agent_search API bridge tool"
```

---

### Task 6: Create API bridge — agent_analytics tool

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/analytics.ts`

- [ ] **Step 1: Create analytics tool**

```typescript
import { z } from "zod";
import { apiFetch, isValidStellarAddress } from "./client.js";

export const analyticsSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
  period: z.enum(["7d", "30d", "90d", "all"]).optional().describe("Time period for analytics"),
});

export type AnalyticsParams = z.infer<typeof analyticsSchema>;

interface AnalyticsResponse {
  address: string;
  period: string;
  volume_over_time: Array<{ date: string; volume: string }>;
  counterparty_growth: Array<{ date: string; unique_counterparties: number }>;
  score_trajectory: Array<{ date: string; score: number }>;
  rating_breakdown: {
    quality: { avg: number; count: number };
    speed: { avg: number; count: number };
    reliability: { avg: number; count: number };
    communication: { avg: number; count: number };
  };
  summary: {
    total_volume: string;
    total_interactions: number;
    unique_counterparties: number;
    avg_rating: number;
  };
}

export async function agentAnalytics(params: AnalyticsParams): Promise<AnalyticsResponse> {
  if (!isValidStellarAddress(params.address)) {
    throw new Error(`Invalid Stellar address: ${params.address}. Expected format: G... (56 chars)`);
  }

  const query: Record<string, string> = {};
  if (params.period) query.period = params.period;

  return apiFetch<AnalyticsResponse>(`/agents/${params.address}/stats`, query);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tools/agent-passport-mcp/src/api-bridge/analytics.ts
git commit -m "feat(mcp): add agent_analytics API bridge tool"
```

---

### Task 7: Create API bridge — agent_badge_stats tool

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/badge.ts`

- [ ] **Step 1: Create badge tool**

```typescript
import { z } from "zod";
import { apiFetch, isValidStellarAddress } from "./client.js";

export const badgeSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
});

export type BadgeParams = z.infer<typeof badgeSchema>;

interface BadgeStatsResponse {
  address: string;
  name: string;
  trust_tier: string;
  score: number;
  verified_interactions_count: number;
  total_economic_volume: string;
  total_counterparties: number;
}

export async function agentBadgeStats(params: BadgeParams): Promise<BadgeStatsResponse> {
  if (!isValidStellarAddress(params.address)) {
    throw new Error(`Invalid Stellar address: ${params.address}. Expected format: G... (56 chars)`);
  }

  return apiFetch<BadgeStatsResponse>(`/badge-stats/${params.address}`);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tools/agent-passport-mcp/src/api-bridge/badge.ts
git commit -m "feat(mcp): add agent_badge_stats API bridge tool"
```

---

### Task 8: Create API bridge — agent_trust_check tool

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/trust-check.ts`

- [ ] **Step 1: Create trust-check tool**

```typescript
import { z } from "zod";
import { apiFetch, isValidStellarAddress } from "./client.js";

export const trustCheckSchema = z.object({
  address: z.string().describe("Stellar address of the agent (G...)"),
  minScore: z.number().int().min(0).max(100).optional().describe("Minimum trust score required"),
  minInteractions: z.number().int().min(0).optional().describe("Minimum verified interactions required"),
});

export type TrustCheckParams = z.infer<typeof trustCheckSchema>;

interface TrustCheckResponse {
  passed: boolean;
  reasons: string[];
  trust_tier: string;
  score: number;
  verified_interactions_count: number;
}

export async function agentTrustCheck(params: TrustCheckParams): Promise<TrustCheckResponse> {
  if (!isValidStellarAddress(params.address)) {
    throw new Error(`Invalid Stellar address: ${params.address}. Expected format: G... (56 chars)`);
  }

  const query: Record<string, string> = {};
  if (params.minScore !== undefined) query.minScore = String(params.minScore);
  if (params.minInteractions !== undefined) query.minInteractions = String(params.minInteractions);

  return apiFetch<TrustCheckResponse>(`/trust-check/${params.address}`, query);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add tools/agent-passport-mcp/src/api-bridge/trust-check.ts
git commit -m "feat(mcp): add agent_trust_check API bridge tool"
```

---

### Task 9: Create API bridge index and register all bridge tools

**Files:**
- Create: `tools/agent-passport-mcp/src/api-bridge/index.ts`
- Modify: `tools/agent-passport-mcp/src/index.ts`

- [ ] **Step 1: Create api-bridge/index.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchSchema, agentSearch } from "./search.js";
import { analyticsSchema, agentAnalytics } from "./analytics.js";
import { badgeSchema, agentBadgeStats } from "./badge.js";
import { trustCheckSchema, agentTrustCheck } from "./trust-check.js";

export function registerApiBridgeTools(server: McpServer): void {
  server.tool(
    "agent_search",
    "Search agents with full-text search and filters (score, tags, interactions, volume). Returns paginated results with trust tiers.",
    searchSchema.shape,
    async (params) => {
      try {
        const result = await agentSearch(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_analytics",
    "Get analytics for an agent — volume over time, score trajectory, rating breakdown, and summary stats.",
    analyticsSchema.shape,
    async (params) => {
      try {
        const result = await agentAnalytics(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_badge_stats",
    "Get trust badge data for an agent — trust tier, score, interactions, counterparties, volume. Use for embedding trust badges.",
    badgeSchema.shape,
    async (params) => {
      try {
        const result = await agentBadgeStats(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "agent_trust_check",
    "Quick trust verification — check if an agent meets minimum score and interaction thresholds. Returns pass/fail with reasons.",
    trustCheckSchema.shape,
    async (params) => {
      try {
        const result = await agentTrustCheck(params);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
```

- [ ] **Step 2: Update index.ts to register bridge tools**

Add to `src/index.ts` after the contract tools registration:

```typescript
import { registerApiBridgeTools } from "./api-bridge/index.js";

// ... after registerContractTools(server, { ... });
registerApiBridgeTools(server);
```

- [ ] **Step 3: Add zod dependency**

Run: `cd tools/agent-passport-mcp && npm install zod`
Add `"zod"` to `dependencies` in `package.json`.

- [ ] **Step 4: Build and verify**

Run: `cd tools/agent-passport-mcp && npm run build`
Expected: No errors

- [ ] **Step 5: Verify all 22 tools are registered**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | timeout 5 STELLAR_CONTRACT_ID=CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ node build/src/index.js 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); tools=[t['name'] for t in data['result']['tools']]; print(f'{len(tools)} tools:'); [print(f'  - {t}') for t in tools]"
```
Expected: 22 tools listed (18 contract + 4 API bridge)

- [ ] **Step 6: Commit**

```bash
git add tools/agent-passport-mcp/
git commit -m "feat(mcp): register all 4 API bridge tools (search, analytics, badge, trust-check)"
```

---

### Task 10: Test API bridge tools against live server

**Files:**
- No new files — verification only

- [ ] **Step 1: Ensure API server is running**

Verify: `curl -s http://localhost:3002/health`
Expected: JSON response with health info

- [ ] **Step 2: Test agent_search**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_search","arguments":{"limit":3}}}' | timeout 10 AGENTPASSPORT_API_URL=http://localhost:3002 node build/src/index.js 2>/dev/null | python3 -m json.tool | head -20
```
Expected: Array of agents with trust_tier, score, name fields

- [ ] **Step 3: Test agent_trust_check**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_trust_check","arguments":{"address":"GBVDQYSFGXEACZD7LG3NI7UAGLOP72D5SDDNJTHHWHD5EYDZHTPLG2IR"}}}' | timeout 10 AGENTPASSPORT_API_URL=http://localhost:3002 node build/src/index.js 2>/dev/null | python3 -m json.tool | head -10
```
Expected: `{ passed: true/false, reasons: [...], trust_tier: "..." }`

- [ ] **Step 4: Test agent_badge_stats**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_badge_stats","arguments":{"address":"GBVDQYSFGXEACZD7LG3NI7UAGLOP72D5SDDNJTHHWHD5EYDZHTPLG2IR"}}}' | timeout 10 AGENTPASSPORT_API_URL=http://localhost:3002 node build/src/index.js 2>/dev/null | python3 -m json.tool | head -10
```
Expected: Badge stats with trust_tier, score, interactions

- [ ] **Step 5: Test error handling (bad address)**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_trust_check","arguments":{"address":"invalid"}}}' | timeout 10 AGENTPASSPORT_API_URL=http://localhost:3002 node build/src/index.js 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); print('Error test:', 'isError' in data.get('result',{}).get('content',[{}])[0] or data.get('result',{}).get('isError'))"
```
Expected: isError: true or error message containing "Invalid Stellar address"

- [ ] **Step 6: Test API unreachable**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_search","arguments":{}}}' | timeout 10 AGENTPASSPORT_API_URL=http://localhost:9999 node build/src/index.js 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin); content=data.get('result',{}).get('content',[{}])[0].get('text',''); print('Unreachable test:', 'unreachable' in content.lower())"
```
Expected: Error message containing "unreachable"

- [ ] **Step 7: Commit test results documentation**

No code changes needed if all tests pass. If fixes are needed, commit them.

---

### Task 11: Write SKILL.md

**Files:**
- Create: `docs/skills/agent-passport/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Create `docs/skills/agent-passport/SKILL.md`. Follow the spec structure (Section 2 of `docs/superpowers/specs/2026-04-30-phase55-stellarmcp-discovery-design.md`). Key content to include:

**Frontmatter:**
```yaml
---
name: agent-passport
description: On-chain trust registry for payment-backed AI agent reputation on Stellar.
when_to_use: Verifying trustworthiness of an AI agent before engaging it, checking payment-backed reputation scores, registering an AI agent on the Stellar trust registry, embedding trust badges, searching for trusted agents by capability or score.
---
```

**Trust tiers table:**
| Tier | Requirements |
|------|-------------|
| New | Fewer than 5 verified interactions OR score below 50 |
| Active | 5+ verified interactions AND score 50+, not yet Trusted |
| Trusted | 20+ interactions, score 75+, AND 5+ unique counterparties |

**Quick start example (trust-check via MCP):**
```
Use the agent_trust_check MCP tool with address "G..." to verify an agent meets your minimum trust threshold. If passed is false, check the reasons array for specific failures.
```

**Contract functions — list ALL 18 (8 read + 10 write including cancel_admin_transfer):**
Read: get_agent, list_agents, get_rating, list_agent_interactions, list_agent_ratings, get_config, get_admin, get_relayers
Write: register_agent, register_interaction, submit_rating, update_profile, deregister_agent, add_relayer, remove_relayer, transfer_admin, accept_admin, cancel_admin_transfer

**Common errors table (key codes):**
| Code | Error | Fix |
|------|-------|-----|
| 2 | Ownership conflict — address already registered | Use a different address |
| 9 | Self-rating not allowed | Rate a different agent |
| 10-11 | Name/description too long | Shorten input |
| 17-18 | Name/description required | Provide required fields |

**API bridge tools:** Document all 4 with parameter tables (from spec Section 1).

**REST API reference:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agents` | GET | Search and list agents |
| `/agents/:address` | GET | Full trust profile |
| `/agents/:address/stats` | GET | Analytics |
| `/agents/:address/interactions` | GET | Interaction history |
| `/trust-check/:address` | GET | Quick trust verification |
| `/badge-stats/:address` | GET | Badge embed data |
| `/badge/:address.svg` | GET | SVG badge image |

**See also links:**
- Contract: `https://stellar.expert/explorer/testnet/contract/CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ`
- Docs: `https://agentpassport.dev/docs` (or localhost in dev)
- Repo: `https://github.com/ggoldani/agent-passport`

Content must follow stellarskills golden rules: no fluff, dense/factual, code snippets, isolated context, common errors table.

- [ ] **Step 2: Validate SKILL.md format**

Run: `wc -l docs/skills/agent-passport/SKILL.md`
Expected: 200-500 lines (dense but comprehensive)

Run: `head -10 docs/skills/agent-passport/SKILL.md`
Expected: Valid YAML frontmatter with `---` delimiters

- [ ] **Step 3: Commit**

```bash
git add -f docs/skills/agent-passport/SKILL.md
git commit -m "docs: add comprehensive SKILL.md for AI agent discovery"
```

---

### Task 12: Write MCP package README

**Files:**
- Create: `tools/agent-passport-mcp/README.md`

- [ ] **Step 1: Write README.md**

```markdown
# AgentPassport MCP Server

MCP server for the AgentPassport trust registry on Stellar. 18 contract tools + 4 REST API bridge tools.

## Setup

1. Install dependencies:
   ```bash
   cd tools/agent-passport-mcp
   npm install
   npm run build
   ```

2. Configure your MCP client:

**Cursor / Claude Desktop (.json config):**
```json
{
  "mcpServers": {
    "agent-passport": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/tools/agent-passport-mcp/build/src/index.js"],
      "env": {
        "STELLAR_NETWORK": "testnet",
        "STELLAR_CONTRACT_ID": "CAYIR5ON6NDKCQ2KLPFHDJTNKEQHSTJP3ZBMRVV4QPEEAI5ZGLN4A7VQ",
        "AGENTPASSPORT_API_URL": "http://localhost:3002"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `STELLAR_NETWORK` | No | `testnet` | Stellar network |
| `STELLAR_CONTRACT_ID` | Yes | — | Deployed contract ID |
| `STELLAR_RPC_URL` | No | Network default | Soroban RPC URL |
| `STELLAR_SECRET_KEY` | No | — | For write operations |
| `AGENTPASSPORT_API_URL` | No | `http://localhost:3002` | REST API base URL |

## Tools

### Contract Tools (18)
Auto-generated from contract WASM. Read trust profiles, list agents, register, rate, etc.

### API Bridge Tools (4)
Wrap the REST API for enriched data:
- `agent_search` — Full-text search with filters
- `agent_analytics` — Volume, score trajectory, rating breakdown
- `agent_badge_stats` — Trust badge data
- `agent_trust_check` — Quick trust verification

## SKILL.md

AI agents can discover AgentPassport via the stellarskills knowledge base:
`raw.githubusercontent.com/ggoldani/stellarskills/main/agent-passport/SKILL.md`
```

- [ ] **Step 2: Commit**

```bash
git add tools/agent-passport-mcp/README.md
git commit -m "docs(mcp): add README with setup instructions"
```

---

### Task 13: Final verification and cleanup

**Files:**
- Modify: `docs/roadmap.md` (mark Phase 5.5 DONE)
- Clean up: `tools/agent-passport-mcp/SPIKE.md`

- [ ] **Step 1: Full typecheck**

Run: `cd tools/agent-passport-mcp && npm run typecheck`
Expected: No errors

Run: `cd /home/debian/Documents/Projects/agent-passport && npx tsc --noEmit --project tsconfig.json 2>&1 | grep -v "demo-e2e"`
Expected: No errors

- [ ] **Step 2: Verify all tools registered**

Run: count tools via MCP tools/list call (same as Task 9 step 5)
Expected: 22 tools

- [ ] **Step 3: Verify SKILL.md is fetchable**

Run: `head -5 docs/skills/agent-passport/SKILL.md`
Expected: Valid YAML frontmatter

- [ ] **Step 4: Update roadmap**

In `docs/roadmap.md`, update Phase 5.5 status from current text to:

```
### 5.5 Trust Query Integration via StellarMCP + AI Discovery Skills

**Status:** DONE. [Date]. [N] commits. `tsc --noEmit` zero errors (MCP package + root).

**Delivered:**
- MCP server at `tools/agent-passport-mcp/` with 22 tools (18 contract + 4 REST API bridge)
- Generated contract tools from WASM via `stellarmcp-generate`
- API bridge tools: agent_search, agent_analytics, agent_badge_stats, agent_trust_check
- SKILL.md at `docs/skills/agent-passport/SKILL.md`
- SKILL.md submitted to stellarskills repo
```

- [ ] **Step 5: Clean up spike file**

Run: `rm -f tools/agent-passport-mcp/SPIKE.md`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: mark Phase 5.5 DONE in roadmap, final cleanup"
```

---

### Task 14: Submit SKILL.md to stellarskills repo

**Files:**
- External: `ggoldani/stellarskills` repo (PR)

This task requires manual action — create a PR to the stellarskills repo.

- [ ] **Step 1: Fork or clone stellarskills**

```bash
cd /tmp
git clone https://github.com/ggoldani/stellarskills.git
cd stellarskills
git checkout -b add-agent-passport-skill
```

- [ ] **Step 2: Copy SKILL.md**

```bash
mkdir -p agent-passport
cp /home/debian/Documents/Projects/agent-passport/docs/skills/agent-passport/SKILL.md agent-passport/SKILL.md
```

- [ ] **Step 3: Update root SKILL.md index**

Add AgentPassport to the skill index table in `SKILL.md`. Add a row under an appropriate category or create a "Trust & Reputation" section:

```markdown
| **AgentPassport** | [`/agent-passport/SKILL.md`](https://raw.githubusercontent.com/ggoldani/stellarskills/main/agent-passport/SKILL.md) | On-chain trust registry for payment-backed AI agent reputation. MCP tools, trust tiers, badge embedding. |
```

- [ ] **Step 4: Commit and push**

```bash
git add agent-passport/SKILL.md SKILL.md
git commit -m "feat: add AgentPassport trust registry skill"
git push -u origin add-agent-passport-skill
```

- [ ] **Step 5: Create PR**

Run: `gh pr create --title "feat: add AgentPassport trust registry skill" --body "Adds agent-passport/SKILL.md and updates root index."`

---

## Dependency Graph

```
Task 1 (scaffold) → Task 2 (generator spike) → Task 3 (generate + integrate)
                                                    ↓
Task 4 (client) → Task 5 (search) → Task 6 (analytics) → Task 7 (badge) → Task 8 (trust-check)
                                                                                    ↓
                                                                              Task 9 (register bridge)
                                                                                    ↓
                                                                              Task 10 (test API bridge)
                                                                                    ↓
                                                                              Task 11 (SKILL.md)
                                                                                    ↓
                                                                              Task 12 (README)
                                                                                    ↓
                                                                              Task 13 (final verify)
                                                                                    ↓
                                                                              Task 14 (stellarskills PR)
```

Note: Tasks 4-8 can be done in parallel after Task 1. Task 10 requires the API server running.
