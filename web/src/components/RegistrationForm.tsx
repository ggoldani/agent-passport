"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  type RegistrationConfig,
  type FormInput,
  type FormValidationError,
  validateFormInput,
  formInputToProfileInput,
  buildAndPrepareRegistrationTx,
  submitSignedTransaction,
  mapContractError,
  buildBadgeSnippet,
} from "@/lib/registration"

type RegistrationState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "signing"; address: string }
  | { status: "submitting"; address: string }
  | { status: "success"; txHash: string; address: string }
  | { status: "error"; message: string }

interface RegistrationFormProps {
  config: RegistrationConfig
  publicApiUrl: string
}

export function RegistrationForm({ config, publicApiUrl }: RegistrationFormProps) {
  const [state, setState] = useState<RegistrationState>({ status: "idle" })
  const [formInput, setFormInput] = useState<FormInput>({
    name: "",
    description: "",
    tags: "",
    service_url: "",
    mcp_server_url: "",
    payment_endpoint: "",
  })
  const [validationErrors, setValidationErrors] = useState<FormValidationError[]>([])
  const [kitReady, setKitReady] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const walletAddressRef = useRef<string | null>(null)
  const kitButtonRef = useRef<HTMLDivElement>(null)
  const abortedRef = useRef(false)
  const formInputRef = useRef(formInput)
  formInputRef.current = formInput

  useEffect(() => {
    let cancelled = false
    let unsub1: (() => void) | undefined
    let unsub2: (() => void) | undefined
    let syncInterval: number | undefined

    const applyAddress = (nextAddress: string | null) => {
      const previousAddress = walletAddressRef.current

      if (nextAddress !== previousAddress) {
        setState({ status: "idle" })
        setValidationErrors([])
      }

      walletAddressRef.current = nextAddress
      setWalletAddress(nextAddress)
    }

    const syncWalletAddress = async () => {
      try {
        const { StellarWalletsKit } = await import("@creit-tech/stellar-wallets-kit/sdk")
        const { address } = await StellarWalletsKit.fetchAddress()
        if (cancelled) return
        applyAddress(address ?? null)
      } catch {
        if (cancelled) return
        walletAddressRef.current = null
        setWalletAddress(null)
      }
    }

    const onWindowFocus = () => {
      void syncWalletAddress()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncWalletAddress()
    }

    ;(async () => {
      const { StellarWalletsKit } = await import("@creit-tech/stellar-wallets-kit/sdk")
      const { defaultModules } = await import("@creit-tech/stellar-wallets-kit/modules/utils")
      const { KitEventType } = await import("@creit-tech/stellar-wallets-kit/types")

      if (cancelled) return

      StellarWalletsKit.init({ modules: defaultModules() })
      if (kitButtonRef.current) {
        await StellarWalletsKit.createButton(kitButtonRef.current)
      }

      unsub1 = StellarWalletsKit.on(KitEventType.STATE_UPDATED, () => {
        void syncWalletAddress()
      })
      unsub2 = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
        walletAddressRef.current = null
        setWalletAddress(null)
        setState({ status: "idle" })
      })

      window.addEventListener("focus", onWindowFocus)
      document.addEventListener("visibilitychange", onVisibilityChange)
      syncInterval = window.setInterval(() => {
        void syncWalletAddress()
      }, 2000)

      if (!cancelled && kitButtonRef.current) setKitReady(true)
      await syncWalletAddress()
    })()

    return () => {
      cancelled = true
      abortedRef.current = true
      if (syncInterval !== undefined) window.clearInterval(syncInterval)
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      unsub1?.()
      unsub2?.()
    }
  }, [])

  const resetForm = useCallback(() => {
    setFormInput({
      name: "",
      description: "",
      tags: "",
      service_url: "",
      mcp_server_url: "",
      payment_endpoint: "",
    })
    setValidationErrors([])
    setState({ status: "idle" })
  }, [])

  const handleSubmit = useCallback(async () => {
    const currentFormInput = formInputRef.current
    const errors = validateFormInput(currentFormInput)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors([])

    try {
      const { StellarWalletsKit } = await import("@creit-tech/stellar-wallets-kit/sdk")
      if (abortedRef.current) return
      setState({ status: "connecting" })

      const result = await StellarWalletsKit.fetchAddress()
      if (abortedRef.current) return
      const address = result.address
      if (!address) {
        setState({
          status: "error",
          message: "No wallet address returned. Please connect a wallet and try again.",
        })
        return
      }

      if (abortedRef.current) return
      setState({ status: "signing", address })

      const profileInput = formInputToProfileInput(currentFormInput)
      const preparedTxXdr = await buildAndPrepareRegistrationTx(address, profileInput)
      if (abortedRef.current) return

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(preparedTxXdr, {
        networkPassphrase: config.networkPassphrase,
        address,
      })
      if (abortedRef.current) return

      setState({ status: "submitting", address })

      const submitResult = await submitSignedTransaction(signedTxXdr)
      if (abortedRef.current) return
      setState({ status: "success", txHash: submitResult.txHash, address })
    } catch (error: unknown) {
      if (abortedRef.current) return
      const msg = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : String(error)
      if (msg.includes("getAccount") || msg.includes("not funded") || msg.includes("Account not found")) {
        setState({
          status: "error",
          message:
            "Your wallet account is not funded. Please fund it with at least 1 XLM using the Stellar testnet faucet.",
        })
        return
      }
      if (msg.includes("rejected") || msg.includes("User rejected")) {
        setState({ status: "idle" })
        return
      }
      if (msg.includes("already registered")) {
        setState({ status: "error", message: "This address is already registered" })
        return
      }
      if (msg.startsWith("Registration API error (")) {
        const apiMessage = msg.replace(/^Registration API error \(\d{3}\):\s*/, "")
        setState({
          status: "error",
          message:
            apiMessage && apiMessage !== "unknown error"
              ? apiMessage
              : "Registration endpoint returned an error. Please try again.",
        })
        return
      }
      if (msg.includes("Error(Contract,")) {
        setState({ status: "error", message: mapContractError(error) })
        return
      }
      setState({ status: "error", message: msg || "Registration failed. Please try again." })
    }
  }, [config])

  function renderFormFields() {
    return (
      <div className="grid gap-3">
        <FieldGroup
          label="Agent Name"
          fieldId="reg-name"
          required
          error={validationErrors.find((e) => e.field === "name")}
        >
          <Input
            id="reg-name"
            value={formInput.name}
            onChange={(e) => setFormInput({ ...formInput, name: e.target.value })}
            placeholder="My AI Agent"
            maxLength={128}
            disabled={isBusy}
          />
        </FieldGroup>
        <FieldGroup
          label="Description"
          fieldId="reg-description"
          required
          error={validationErrors.find((e) => e.field === "description")}
        >
          <textarea
            id="reg-description"
            value={formInput.description}
            onChange={(e) => setFormInput({ ...formInput, description: e.target.value })}
            placeholder="Provides data analysis services..."
            maxLength={512}
            disabled={isBusy}
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </FieldGroup>
        <FieldGroup
          label="Tags"
          fieldId="reg-tags"
          hint="Comma-separated, max 20 tags, each max 32 chars"
          error={validationErrors.find((e) => e.field === "tags")}
        >
          <Input
            id="reg-tags"
            value={formInput.tags}
            onChange={(e) => setFormInput({ ...formInput, tags: e.target.value })}
            placeholder="analytics, data, api"
            disabled={isBusy}
          />
        </FieldGroup>
        <FieldGroup
          label="Service URL"
          fieldId="reg-service-url"
          hint="Your agent's service endpoint"
          error={validationErrors.find((e) => e.field === "service_url")}
        >
          <Input
            id="reg-service-url"
            value={formInput.service_url}
            onChange={(e) => setFormInput({ ...formInput, service_url: e.target.value })}
            placeholder="https://..."
            maxLength={256}
            disabled={isBusy}
          />
        </FieldGroup>
        <FieldGroup
          label="MCP Server URL"
          fieldId="reg-mcp-url"
          hint="Model Context Protocol server address"
          error={validationErrors.find((e) => e.field === "mcp_server_url")}
        >
          <Input
            id="reg-mcp-url"
            value={formInput.mcp_server_url}
            onChange={(e) => setFormInput({ ...formInput, mcp_server_url: e.target.value })}
            placeholder="https://..."
            maxLength={256}
            disabled={isBusy}
          />
        </FieldGroup>
        <FieldGroup
          label="Payment Endpoint"
          fieldId="reg-payment"
          hint="x402 payment endpoint URL"
          error={validationErrors.find((e) => e.field === "payment_endpoint")}
        >
          <Input
            id="reg-payment"
            value={formInput.payment_endpoint}
            onChange={(e) => setFormInput({ ...formInput, payment_endpoint: e.target.value })}
            placeholder="https://..."
            maxLength={256}
            disabled={isBusy}
          />
        </FieldGroup>
      </div>
    )
  }

  if (state.status === "success") {
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${state.txHash}`
    const profileUrl = `/agents/${state.address}`
    const badgeSnippet = buildBadgeSnippet(publicApiUrl, state.address)

    return (
      <div className="grid gap-4">
        <div className="rounded-md border border-border-strong bg-accent-soft p-4">
          <p className="mb-2 text-lg font-semibold text-accent">Registration Successful</p>
          <p className="mb-4 text-sm text-muted">Your agent profile is now live on the Stellar testnet.</p>
          <div className="mb-4 flex gap-3 max-[720px]:flex-wrap">
            <a href={explorerUrl} rel="noreferrer noopener" target="_blank" className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent">
              View Transaction
            </a>
            <a href={profileUrl} className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent">
              View Profile
            </a>
            <button onClick={resetForm} className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent">
              Register Another
            </button>
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">Embed Trust Badge</p>
            <pre className="overflow-auto rounded-md border border-border bg-background/50 p-3 font-mono text-xs text-foreground">
              {badgeSnippet}
            </pre>
            <p className="mt-1 text-xs text-muted">Copy and paste this into your website or documentation.</p>
          </div>
        </div>
      </div>
    )
  }

  const isBusy = state.status !== "idle"

  if (state.status === "error") {
    return (
      <div className="grid gap-4">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="mb-2 text-base font-semibold text-destructive">Registration Failed</p>
          <p className="text-sm text-muted">{state.message}</p>
        </div>
        <div className="flex gap-3 max-[720px]:flex-wrap">
          <button onClick={handleSubmit} className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent">
            Try Again
          </button>
          <button onClick={resetForm} className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-surface hover:text-accent">
            Reset Form
          </button>
        </div>
        {renderFormFields()}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {renderFormFields()}
      <div ref={kitButtonRef} />
      <button
        onClick={handleSubmit}
        disabled={!kitReady || isBusy}
        className={`inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-bold transition-all ${
          !kitReady || isBusy
            ? "cursor-not-allowed border border-border-strong bg-surface-strong/70 text-muted opacity-50"
            : "border-0 bg-gradient-to-r from-accent to-amber-600 text-background hover:-translate-y-px hover:shadow-[0_0_24px_rgba(245,158,11,0.35)]"
        }`}
      >
        {!kitReady
          ? "Loading wallet kit..."
          : state.status === "connecting"
            ? "Connecting wallet..."
            : state.status === "signing"
              ? "Waiting for wallet signature..."
              : state.status === "submitting"
                ? "Submitting transaction..."
                : "Connect Wallet & Register"}
      </button>
      <p className="text-center font-mono text-xs text-muted">
        {walletAddress ? `Connected wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "No wallet connected"}
      </p>
      {(state.status === "signing" || state.status === "submitting") &&
        "address" in state && (
          <p className="text-center font-mono text-xs text-muted">
            {state.address}
          </p>
        )}
    </div>
  )
}

function FieldGroup({
  label,
  fieldId,
  required,
  hint,
  error,
  children,
}: {
  label: string
  fieldId: string
  required?: boolean
  hint?: string
  error?: FormValidationError
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block font-mono text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-0.5 text-xs text-destructive">{error.message}</p>}
    </div>
  )
}
