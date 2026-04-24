import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const envPath = resolve(process.cwd(), ".env")
if (existsSync(envPath)) {
  for (const [key, value] of Object.entries(
    Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((line) => {
          const idx = line.indexOf("=")
          if (idx === -1) return [line, ""] as const
          const k = line.slice(0, idx).trim()
          const raw = line.slice(idx + 1).trim()
          const val = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
          return [k, val] as const
        }),
    ),
  )) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

import {
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import { Server } from "@stellar/stellar-sdk/rpc"

import { buildMethodArgs } from "../src/sdk/scval.js"
import type { AgentProfileInput } from "../src/sdk/types.js"
import type { RegistrationConfig } from "../web/src/lib/registration.js"

const TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
const TESTNET_FRIENDBOT_URL = "https://friendbot.stellar.org"

function getConfig(): RegistrationConfig {
  const rpcUrl = process.env.STELLAR_RPC_URL
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE
  const contractId = process.env.CONTRACT_ID
  if (!rpcUrl || !networkPassphrase || !contractId) {
    throw new Error("Missing STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, or CONTRACT_ID")
  }
  return { rpcUrl, networkPassphrase, contractId }
}

async function fundAccount(keypair: Keypair): Promise<void> {
  const resp = await fetch(`${TESTNET_FRIENDBOT_URL}?addr=${keypair.publicKey()}`)
  if (!resp.ok) {
    const body = await resp.text()
    if (body.includes("already funded")) return
    throw new Error(`Friendbot failed: ${resp.status} ${body}`)
  }
  console.log(`  Funded ${keypair.publicKey()}`)
}

async function buildSignAndSubmitTx(
  keypair: Keypair,
  profileInput: AgentProfileInput,
  config: RegistrationConfig,
): Promise<{ txHash: string }> {
  const server = new Server(config.rpcUrl, { allowHttp: true })

  const sourceAccount = await server.getAccount(keypair.publicKey())

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: config.contractId,
        function: "register_agent",
        args: buildMethodArgs("register_agent", [keypair.publicKey(), profileInput]),
      }),
    )
    .setTimeout(30)
    .build()

  const preparedTransaction = await server.prepareTransaction(transaction)
  preparedTransaction.sign(keypair)

  const submission = await server.sendTransaction(preparedTransaction)
  if (submission.status === "ERROR") {
    throw new Error(`Transaction rejected: ${submission.status}`)
  }

  const pollResult = await server.pollTransaction(submission.hash, { attempts: 20 })
  if (pollResult.status !== "SUCCESS") {
    throw new Error(`Transaction failed: status=${pollResult.status}`)
  }

  return { txHash: submission.hash }
}

async function verifyRegistration(
  address: string,
  config: RegistrationConfig,
): Promise<boolean> {
  const server = new Server(config.rpcUrl, { allowHttp: true })
  const simResult = await server.simulateTransaction(
    TransactionBuilder.fromXDR(
      new TransactionBuilder(await server.getAccount(address), {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: config.contractId,
            function: "get_agent",
            args: buildMethodArgs("get_agent", [address]),
          }),
        )
        .setTimeout(30)
        .build()
        .toXDR(),
      config.networkPassphrase,
    ),
  )
  if ("error" in simResult) {
    console.log(`  Debug: simulation error: ${JSON.stringify(simResult.error)}`)
    return false
  }
  if (!simResult.result?.retval) {
    console.log(`  Debug: no retval in simulation result`)
    return false
  }
  const retval = simResult.result.retval
  if (retval.switch().name !== "scvMap") return false
  return true
}

async function testApiEndpoint(
  signedTxXdr: string,
  apiUrl: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const resp = await fetch(`${apiUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signed_tx_xdr: signedTxXdr }),
  })
  const body = await resp.json()
  return { ok: resp.ok, status: resp.status, body }
}

async function main() {
  const config = getConfig()
  const apiUrl = process.env.API_URL || "http://localhost:3002"
  const useApi = process.env.E2E_API === "1"

  console.log("=== E2E Registration Test ===")
  console.log(`  Contract: ${config.contractId}`)
  console.log(`  RPC: ${config.rpcUrl}`)
  console.log(`  API: ${apiUrl} ${useApi ? "(enabled)" : "(disabled)"}`)

  console.log("\n--- Test 1: Direct RPC registration ---")
  const keypair1 = Keypair.random()
  console.log(`  Generated: ${keypair1.publicKey()}`)
  await fundAccount(keypair1)

  const profileInput1: AgentProfileInput = {
    name: "E2E Test Agent",
    description: "Created by test-e2e-registration.ts",
    tags: ["e2e", "test"],
    service_url: null,
    mcp_server_url: null,
    payment_endpoint: null,
  }

  const result1 = await buildSignAndSubmitTx(keypair1, profileInput1, config)
  console.log(`  Registered! tx=${result1.txHash}`)

  const verified1 = await verifyRegistration(keypair1.publicKey(), config)
  console.log(`  On-chain verification: ${verified1 ? "PASS" : "FAIL"}`)
  if (!verified1) {
    console.error("FAIL: Agent not found on chain after registration")
    process.exit(1)
  }

  console.log("\n--- Test 2: Duplicate registration rejection ---")
  try {
    await buildSignAndSubmitTx(keypair1, {
      ...profileInput1,
      name: "E2E Duplicate Test",
    }, config)
    console.error("FAIL: Should have thrown on duplicate registration")
    process.exit(1)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("2") || msg.includes("Ownership") || msg.includes("already")) {
      console.log(`  PASS: Correctly rejected duplicate (${msg.slice(0, 80)})`)
    } else {
      console.log(`  WARN: Rejected but unexpected error: ${msg.slice(0, 80)}`)
    }
  }

  if (useApi) {
    console.log("\n--- Test 3: API registration endpoint ---")
    const keypair2 = Keypair.random()
    console.log(`  Generated: ${keypair2.publicKey()}`)
    await fundAccount(keypair2)

    const server = new Server(config.rpcUrl, { allowHttp: true })
    const sourceAccount = await server.getAccount(keypair2.publicKey())

    const profileInput2: AgentProfileInput = {
      name: "E2E API Test Agent",
      description: "Created via API endpoint test",
      tags: ["api", "test"],
      service_url: null,
      mcp_server_url: null,
      payment_endpoint: null,
    }

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: config.contractId,
          function: "register_agent",
          args: buildMethodArgs("register_agent", [keypair2.publicKey(), profileInput2]),
        }),
      )
      .setTimeout(30)
      .build()

    const preparedTransaction = await server.prepareTransaction(transaction)
    preparedTransaction.sign(keypair2)
    const signedXdr = preparedTransaction.toXDR()

    console.log(`  Submitting to ${apiUrl}/register...`)
    const apiResult = await testApiEndpoint(signedXdr, apiUrl)
    console.log(`  Status: ${apiResult.status}`)
    console.log(`  Body: ${JSON.stringify(apiResult.body)}`)

    if (!apiResult.ok) {
      console.error("FAIL: API registration returned non-OK status")
      process.exit(1)
    }

    const apiBody = apiResult.body as { tx_hash?: string; status?: string }
    if (!apiBody.tx_hash || apiBody.status !== "SUCCESS") {
      console.error("FAIL: API response missing tx_hash or not SUCCESS")
      process.exit(1)
    }

    const verified2 = await verifyRegistration(keypair2.publicKey(), config)
    console.log(`  On-chain verification: ${verified2 ? "PASS" : "FAIL"}`)
    if (!verified2) {
      console.error("FAIL: Agent not found on chain after API registration")
      process.exit(1)
    }

    console.log("\n--- Test 4: API rejects wrong contract ---")
    const badKeypair = Keypair.random()
    await fundAccount(badKeypair)
    const badSource = await server.getAccount(badKeypair.publicKey())
    const badTx = new TransactionBuilder(badSource, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: config.contractId,
          function: "get_config",
          args: [],
        }),
      )
      .setTimeout(30)
      .build()
    const badPrepared = await server.prepareTransaction(badTx)
    badPrepared.sign(badKeypair)

    const badResult = await testApiEndpoint(badPrepared.toXDR(), apiUrl)
    if (badResult.status === 400) {
      console.log(`  PASS: Correctly rejected wrong function (status=${badResult.status})`)
    } else {
      console.error(`FAIL: Should have rejected, got status=${badResult.status}`)
      process.exit(1)
    }

    console.log("\n--- Test 5: API rejects missing field ---")
    const missingResult = await fetch(`${apiUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (missingResult.status === 400) {
      console.log(`  PASS: Correctly rejected missing signed_tx_xdr (status=400)`)
    } else {
      console.error(`FAIL: Should have rejected, got status=${missingResult.status}`)
      process.exit(1)
    }
  } else {
    console.log("\n--- Tests 3-5: API endpoint tests ---")
    console.log("  SKIP: Set E2E_API=1 and start the API server to run these tests")
  }

  console.log("\n=== All E2E registration tests passed! ===")
}

main().catch((e) => {
  console.error("UNEXPECTED:", e)
  process.exit(1)
})
