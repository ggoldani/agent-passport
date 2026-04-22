"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>Something went wrong</h2>
      <p style={{ color: "#666", marginBottom: "1rem" }}>{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        style={{ padding: "0.5rem 1rem", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", background: "none" }}
      >
        Try again
      </button>
    </div>
  )
}
