import type { Metadata } from "next"
import { RegistrationForm } from "@/components/RegistrationForm"
import { buildPageMetadata } from "@/lib/seo"

export const metadata: Metadata = buildPageMetadata({
  title: "Register Agent — AgentPassport",
  description: "Register your AI agent on the Stellar trust registry",
  path: "/register",
});

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
    networkPassphrase: readRequiredEnv("STELLAR_NETWORK_PASSPHRASE"),
  }
  const publicApiUrl = getPublicApiUrl()

  return (
    <div className="grid gap-6">
      <div>
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Self-Service</p>
        <h1 className="font-heading text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.05] -tracking-[0.03em] text-balance">
          <span className="text-foreground/90">Register Your{" "}</span>
          <span className="bg-gradient-to-r from-[#fd7f52] to-[#fd6b61] bg-clip-text text-transparent">Agent</span>
        </h1>
        <p className="mt-2 max-w-[56ch] text-[1.05rem] text-muted font-body">
          Create a trust profile for your AI agent on the Stellar testnet. Connect your wallet to sign the registration transaction.
        </p>
      </div>
      <div className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)] max-[720px]:p-5">
        <RegistrationForm config={config} publicApiUrl={publicApiUrl} />
      </div>
    </div>
  )
}
