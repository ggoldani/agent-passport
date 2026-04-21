import { applyEnvFile } from "../src/lib/env.js"
import { syncHistorical } from "../src/indexer/sync.js"

applyEnvFile()

const required = ["CONTRACT_ID", "STELLAR_RPC_URL"]
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

syncHistorical({
  contractId: process.env.CONTRACT_ID!,
  rpcUrl: process.env.STELLAR_RPC_URL!,
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE,
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
