import { applyEnvFile } from "../src/lib/env.js"
import { AgentPassportIndexer } from "../src/indexer/index.js"

applyEnvFile()

async function main() {
  if (!process.env.CONTRACT_ID) {
    console.error("Missing CONTRACT_ID env var")
    process.exit(1)
  }

  const indexer = new AgentPassportIndexer({
    contractId: process.env.CONTRACT_ID,
    rpcUrl: process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  })

  console.log("Starting AgentPassport indexer...")
  await indexer.start()
  console.log("Indexer running. Press Ctrl+C to stop.")

  process.on("SIGINT", () => {
    console.log("\nStopping indexer...")
    indexer.stop()
    process.exit(0)
  })
}

main().catch((e) => {
  console.error("Indexer failed:", e)
  process.exit(1)
})
