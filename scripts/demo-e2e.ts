declare const process: {
  argv: string[]
  exitCode?: number
  stdout: {
    write(chunk: string): boolean
  }
}

export interface DemoStep {
  id:
    | "register-agent-a"
    | "pre-payment-trust-lookup"
    | "paid-stellarintel-call"
    | "automatic-worker-verification"
    | "rating-submission"
    | "post-rating-trust-lookup"
  title: string
  narrative: string
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "register-agent-a",
    title: "Register Agent A",
    narrative:
      "Agent A — StellarIntel — registers on AgentPassport and gets a public trust profile.",
  },
  {
    id: "pre-payment-trust-lookup",
    title: "Pre-Payment Trust Lookup",
    narrative:
      "Agent B checks Agent A's public trust profile before deciding to pay.",
  },
  {
    id: "paid-stellarintel-call",
    title: "Paid StellarIntel Call",
    narrative:
      "Agent B pays StellarIntel via x402 for a real premium Stellar intelligence service.",
  },
  {
    id: "automatic-worker-verification",
    title: "Automatic Worker Verification",
    narrative:
      "The relayer verifies the payment and registers the interaction on Soroban.",
  },
  {
    id: "rating-submission",
    title: "Rating Submission",
    narrative:
      "Only after a verified paid interaction can Agent B submit a rating.",
  },
  {
    id: "post-rating-trust-lookup",
    title: "Post-Rating Trust Lookup",
    narrative:
      "Agent A's public trust profile updates immediately after the verified interaction and rating.",
  },
]

export function buildDemoOutline(): string {
  return [
    "AgentPassport demo sequence:",
    ...DEMO_STEPS.map(
      (step, index) => `${index + 1}. ${step.title}: ${step.narrative}`,
    ),
  ].join("\n")
}

export function runDemo(): number {
  process.stdout.write(`${buildDemoOutline()}\n`)
  return 0
}

if (process.argv[1]?.endsWith("scripts/demo-e2e.ts")) {
  process.exitCode = runDemo()
}
