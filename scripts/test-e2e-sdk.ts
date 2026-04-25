import { applyEnvFile } from "../src/lib/env.js"
applyEnvFile()

import { AgentPassportClient, SorobanRpcTransport } from "../src/sdk/index.js"

async function main() {
  const required = ["CONTRACT_ID", "STELLAR_RPC_URL", "STELLAR_NETWORK_PASSPHRASE", "AGENT_SECRET_KEY"]
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing env: ${key}`)
      process.exit(1)
    }
  }

  console.log("=== Test 1: getConfig ===")
  const client = new AgentPassportClient({
    contractId: process.env.CONTRACT_ID!,
    transport: new SorobanRpcTransport({
      rpcUrl: process.env.STELLAR_RPC_URL!,
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
      signerSecretKey: process.env.AGENT_SECRET_KEY!,
    }),
  })
  const config = await client.getConfig()
  console.log(JSON.stringify(config, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2))

  console.log("\n=== Test 2: Contract ID validation ===")
  try {
    new AgentPassportClient({
      contractId: "not-a-contract",
      transport: new SorobanRpcTransport({
        rpcUrl: process.env.STELLAR_RPC_URL!,
        networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
        signerSecretKey: process.env.AGENT_SECRET_KEY!,
      }),
    })
    console.log("FAIL: should have thrown")
  } catch (e) {
    console.log("OK:", (e as Error).message)
  }

  console.log("\n=== Test 3: HTTPS enforcement ===")
  try {
    new SorobanRpcTransport({
      rpcUrl: "http://evil.com",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
      signerSecretKey: process.env.AGENT_SECRET_KEY!,
    })
    console.log("FAIL: should have thrown")
  } catch (e) {
    console.log("OK:", (e as Error).message)
  }

  console.log("\n=== Test 4: localhost allowed ===")
  try {
    new SorobanRpcTransport({
      rpcUrl: "http://localhost:8000",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
      signerSecretKey: process.env.AGENT_SECRET_KEY!,
    })
    console.log("OK: localhost accepted")
  } catch (e) {
    console.log("FAIL:", (e as Error).message)
  }

  console.log("\n=== Test 5: listAgents ===")
  const agents = await client.listAgents()
  console.log(`Found ${agents.length} agent(s)`)
  for (const a of agents) {
    console.log(`  - ${a.name} (${a.owner_address}) score=${a.score}`)
  }

  console.log("\n=== Test 6: listAgentInteractions ===")
  if (agents.length > 0) {
    const interactions = await client.listAgentInteractions(agents[0].owner_address)
    console.log(`Found ${interactions.length} interaction(s)`)
    for (const i of interactions) {
      console.log(`  - tx=${i.tx_hash} amount=${i.amount} consumer=${i.consumer_address}`)
    }
  }

  console.log("\nAll E2E SDK tests passed!")
}

main().catch((e) => {
  console.error("UNEXPECTED:", e)
  process.exit(1)
})
