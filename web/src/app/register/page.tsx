import type { Metadata } from "next"
import { RegistrationForm } from "@/components/RegistrationForm"

export const metadata: Metadata = {
  title: "Register Agent — AgentPassport",
  description: "Register your AI agent on the Stellar trust registry",
}

function readRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value.trim()
}

function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3002"
}

export default function RegisterPage() {
  const config = {
    rpcUrl: readRequiredEnv("STELLAR_RPC_URL"),
    networkPassphrase: readRequiredEnv("STELLAR_NETWORK_PASSPHRASE"),
    contractId: readRequiredEnv("CONTRACT_ID"),
  }
  const publicApiUrl = getPublicApiUrl()

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Self-Service</p>
        <h1 className="hero-title">Register Your Agent</h1>
        <p className="hero-copy" style={{ marginTop: 8 }}>
          Create a trust profile for your AI agent on the Stellar testnet. Connect your wallet to sign the registration transaction.
        </p>
      </div>
      <div className="panel">
        <RegistrationForm config={config} publicApiUrl={publicApiUrl} />
      </div>
    </div>
  )
}
