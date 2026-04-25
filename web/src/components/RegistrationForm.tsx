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
  const kitButtonRef = useRef<HTMLDivElement>(null)
  const abortedRef = useRef(false)
  const formInputRef = useRef(formInput)
  formInputRef.current = formInput

  useEffect(() => {
    let cancelled = false
    let unsub1: (() => void) | undefined
    let unsub2: (() => void) | undefined

    ;(async () => {
      const { StellarWalletsKit } = await import("@creit-tech/stellar-wallets-kit/sdk")
      const { defaultModules } = await import("@creit-tech/stellar-wallets-kit/modules/utils")
      const { KitEventType } = await import("@creit-tech/stellar-wallets-kit/types")

      if (cancelled) return

      StellarWalletsKit.init({ modules: defaultModules() })
      if (kitButtonRef.current) {
        await StellarWalletsKit.createButton(kitButtonRef.current)
      }

      unsub1 = StellarWalletsKit.on(
        KitEventType.STATE_UPDATED,
        (event: { payload: { address: string | undefined } }) => {
          if (event.payload.address) {
            setKitReady(true)
            setWalletAddress(event.payload.address)
          }
        },
      )
      unsub2 = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
        setKitReady(false)
        setWalletAddress(null)
      })

      // kitReady means "the kit button is rendered and interactive", not "a wallet is connected".
      // The kit button itself handles the wallet connection flow. STATE_UPDATED refines
      // the state when a wallet connects/disconnects.
      if (!cancelled && kitButtonRef.current) setKitReady(true)
    })()

    return () => {
      cancelled = true
      abortedRef.current = true
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

      let address = walletAddress
      if (!address) {
        const result = await StellarWalletsKit.getAddress()
        if (abortedRef.current) return
        address = result.address
      }
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
      const preparedTxXdr = await buildAndPrepareRegistrationTx(address, profileInput, config)
      if (abortedRef.current) return

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(preparedTxXdr, {
        networkPassphrase: config.networkPassphrase,
        address,
      })
      if (abortedRef.current) return

      setState({ status: "submitting", address })

      const result = await submitSignedTransaction(signedTxXdr, config)
      if (abortedRef.current) return
      setState({ status: "success", txHash: result.txHash, address })
    } catch (error: unknown) {
      if (abortedRef.current) return
      if (error instanceof Error && error.message.includes("getAccount")) {
        setState({
          status: "error",
          message:
            "Your wallet account is not funded. Please fund it with at least 1 XLM using the Stellar testnet faucet.",
        })
        return
      }
      const message = mapContractError(error)
      setState({ status: "error", message })
    }
  }, [config, walletAddress])

  if (state.status === "success") {
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${state.txHash}`
    const profileUrl = `/agents/${state.address}`
    const badgeSnippet = buildBadgeSnippet(publicApiUrl, state.address)

    return (
      <div className="stack-md">
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border-strong)",
            borderRadius: 4,
            background: "rgba(15, 92, 83, 0.06)",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--accent)", fontSize: "1.1rem", marginBottom: 8 }}>
            Registration Successful
          </p>
          <p className="row-subtle" style={{ marginBottom: 16 }}>
            Your agent profile is now live on the Stellar testnet.
          </p>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <a
              href={explorerUrl}
              rel="noreferrer noopener"
              target="_blank"
              className="text-link"
              style={{
                border: "1px solid var(--border)",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: "0.88rem",
              }}
            >
              View Transaction
            </a>
            <a
              href={profileUrl}
              className="text-link"
              style={{
                border: "1px solid var(--border)",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: "0.88rem",
              }}
            >
              View Profile
            </a>
            <button
              onClick={resetForm}
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: "0.88rem",
              }}
            >
              Register Another
            </button>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Embed Trust Badge
            </p>
            <pre
              style={{
                background: "rgba(0,0,0,0.03)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 12,
                fontSize: "0.78rem",
                overflow: "auto",
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {badgeSnippet}
            </pre>
            <p className="row-subtle" style={{ marginTop: 4, fontSize: "0.78rem" }}>
              Copy and paste this into your website or documentation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isBusy = state.status !== "idle"

  if (state.status === "error") {
    return (
      <div className="stack-md">
        <div
          style={{
            padding: 16,
            border: "1px solid #8b3a3a",
            borderRadius: 4,
            background: "rgba(163, 66, 57, 0.06)",
          }}
        >
          <p style={{ fontWeight: 600, color: "#7b2e28", fontSize: "1rem", marginBottom: 8 }}>
            Registration Failed
          </p>
          <p className="row-subtle">{state.message}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <button
            onClick={resetForm}
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reset Form
          </button>
        </div>
        {renderFormFields()}
      </div>
    )
  }

  return (
    <div className="stack-md">
      {renderFormFields()}
      <div ref={kitButtonRef} />
      <button
        onClick={handleSubmit}
        disabled={!kitReady || isBusy}
        style={{
          padding: "10px 24px",
          border: "1px solid var(--border-strong)",
          background: isBusy ? "var(--surface-strong)" : "var(--accent)",
          color: isBusy ? "var(--muted)" : "white",
          borderRadius: 4,
          cursor: isBusy ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "0.92rem",
        }}
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
      {(state.status === "signing" || state.status === "submitting") &&
        "address" in state && (
          <p
            className="row-subtle row-mono"
            style={{ fontSize: "0.78rem", textAlign: "center" }}
          >
            {state.address}
          </p>
        )}
    </div>
  )

  function renderFormFields() {
    return (
      <div className="stack-sm">
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
            style={{
              width: "100%",
              padding: "6px 12px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "0.92rem",
              resize: "vertical",
            }}
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
      <label
        htmlFor={fieldId}
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: "0.78rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontFamily: "'Courier New', Courier, monospace",
        }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint && (
        <p style={{ marginTop: 2, fontSize: "0.72rem", color: "var(--muted)" }}>{hint}</p>
      )}
      {error && <p style={{ marginTop: 2, fontSize: "0.78rem", color: "#7b2e28" }}>{error.message}</p>}
    </div>
  )
}
