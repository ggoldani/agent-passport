# Generator Spike: stellarmcp-generate

**Status:** DONE
**Date:** 2026-05-04
**Generator:** @ggoldani/stellarmcp v0.1.7

## Installation

```bash
npm install --save-dev @ggoldani/stellarmcp
```

Installs two CLIs: `stellarmcp` and `stellarmcp-generate`.

## Running

```bash
npx stellarmcp-generate \
  --input ../../contracts/agent-passport/target/wasm32v1-none/release/agent_passport.wasm \
  --out ./spike-output \
  --name agent-passport-contract \
  --alias ap
```

Output: `Generated MCP package at ./spike-output (tools prefix: ap_*).`

## Generated Output Structure

```
spike-output/
  package.json
  tsconfig.json
  src/
    index.ts                          # Entry point — stdio MCP server
    server.ts                         # Creates McpServer, calls registerContractTools
    config.ts                         # Zod-validated env config (STELLAR_NETWORK, STELLAR_CONTRACT_ID, etc.)
    registerContractTools.ts          # All server.tool() registrations
    generated/
      meta.ts                         # Generator version, spec fingerprint
      specEntries.ts                  # Contract spec as base64 XDR array
      schemas.ts                      # Zod input schemas for each tool
      typedClient.ts                  # Typed args + GeneratedContractCalls helper
    lib/
      contractInvoke.ts               # invokeContractMethod — simulates, signs, submits
      stellarClient.ts                # Horizon + RPC client factory with timeout
      policy.ts                       # Signing policy (safe/guarded/expert)
      errors.ts                       # Error normalization (network, protocol, Soroban codes)
      redact.ts                       # Secret/bearer token redaction
```

Total generated: ~703 lines of TypeScript across 13 files.

## Tool Count & Names

**17 tools** generated, one per contract function:

| # | Tool Name | Contract Method | Description |
|---|-----------|----------------|-------------|
| 1 | `ap_init` | `init` | Initialize contract (admin, authorized_relayer) |
| 2 | `ap_get_agent` | `get_agent` | Get agent by owner address |
| 3 | `ap_get_config` | `get_config` | Get contract config (admin, pending_admin, relayers_count) |
| 4 | `ap_get_rating` | `get_rating` | Get rating by interaction tx hash |
| 5 | `ap_add_relayer` | `add_relayer` | Add authorized relayer |
| 6 | `ap_list_agents` | `list_agents` | List agents (paginated with from/limit) |
| 7 | `ap_accept_admin` | `accept_admin` | Accept pending admin transfer |
| 8 | `ap_get_relayers` | `get_relayers` | Get all authorized relayers |
| 9 | `ap_submit_rating` | `submit_rating` | Submit a rating |
| 10 | `ap_register_agent` | `register_agent` | Register a new agent |
| 11 | `ap_remove_relayer` | `remove_relayer` | Remove authorized relayer |
| 12 | `ap_transfer_admin` | `transfer_admin` | Transfer admin to new address |
| 13 | `ap_update_profile` | `update_profile` | Update agent profile |
| 14 | `ap_deregister_agent` | `deregister_agent` | Deregister an agent |
| 15 | `ap_register_interaction` | `register_interaction` | Register a provider-agent interaction |
| 16 | `ap_cancel_admin_transfer` | `cancel_admin_transfer` | Cancel pending admin transfer |
| 17 | `ap_list_agent_interactions` | `list_agent_interactions` | List interactions for a provider (paginated) |

## How Registration Works

- `index.ts` → creates `StdioServerTransport`, calls `createServer(config)`, connects
- `server.ts` → creates `McpServer({ name, version })`, calls `registerContractTools(server, config)`
- `registerContractTools.ts` → one `server.tool(name, description, schema, handler)` per contract function
  - Each handler: resolves `contractId` from input or config, calls `invokeContractMethod(config, spec, { contractId, sourceAccount, method, args })`
- `invokeContractMethod` in `contractInvoke.ts`: builds the Stellar transaction, simulates, optionally signs, submits to RPC

## Tool Input Schema Pattern

Every tool receives:
- `contractId` (optional, overrides `STELLAR_CONTRACT_ID` env)
- `sourceAccount` (required G... public key for transaction signing)
- Plus method-specific parameters derived from the contract spec

Complex Soroban types (`AgentProfileInput`, `RatingInput`, `InteractionRecord`) are typed as `z.unknown()` — validated at invocation time by `Spec.funcArgsToScVals`.

## Config (Environment Variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_NETWORK` | No | `testnet` | `mainnet` or `testnet` |
| `STELLAR_CONTRACT_ID` | Yes | — | C... contract strkey |
| `STELLAR_SECRET_KEY` | No | — | S... secret for signing |
| `STELLAR_RPC_URL` | No | Soroban default | Custom RPC endpoint |
| `STELLAR_HORIZON_URL` | No | Horizon default | Custom Horizon endpoint |
| `STELLAR_REQUEST_TIMEOUT_MS` | No | 30000 | Request timeout |
| `STELLAR_AUTO_SIGN` | No | false | Enable auto-signing |
| `STELLAR_AUTO_SIGN_POLICY` | No | — | `safe`, `guarded`, or `expert` |
| `STELLAR_AUTO_SIGN_LIMIT` | No | 0 | XLM limit for guarded policy |

## Build Verification

```bash
cd spike-output && npm install && npm run build
```

**Build succeeded with zero errors.** Generated code compiles cleanly against:
- `@modelcontextprotocol/sdk` ^1.27.1
- `@stellar/stellar-sdk` ^14.6.1
- `zod` ^4.3.6
- TypeScript ^5.9.3

## Key Findings

1. **Generator works perfectly** — reads WASM spec, produces a complete, buildable MCP server.
2. **17 of 18 contract functions** are covered. The 18th function in our manual implementation (`get_version`) is likely a generated/read-only helper that may not appear in the WASM spec as an invocable method, or may be excluded by the generator. Need to verify.
3. **Template lib code is high quality** — includes signing policies, error normalization with actionable messages, secret redaction, and timeout handling. This is production-ready boilerplate.
4. **Typed but loose for complex types** — `z.unknown()` for struct args means validation happens at Soroban level, not Zod level. We'll want to add stricter schemas for the MCP layer.
5. **Stdio transport only** — generated server uses `StdioServerTransport`. We'll add SSE/HTTP transport for the REST API bridge.
6. **No REST API bridge tools** — generator only produces contract invocation tools. The 4 REST API bridge tools from our plan need to be hand-written.

## Concerns

- **Version compatibility:** Generated code pins `@stellar/stellar-sdk` ^14.6.1 and `zod` ^4.3.6. Our existing package.json uses different SDK version. Need to align.
- **Naming collision:** Our existing `src/` has manual tool implementations. We'll need to replace or integrate carefully.
- **Missing `get_version`:** Need to check if this is in the WASM spec or if it was a manual addition.

## Next Steps

1. Verify `get_version` presence in contract spec
2. Align dependency versions with existing project
3. Integrate generated `lib/` code as base, replace manual `src/` with generated + custom REST bridge tools
4. Add stricter Zod schemas for complex struct inputs
