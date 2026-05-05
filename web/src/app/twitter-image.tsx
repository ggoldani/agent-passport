import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 35%), linear-gradient(180deg, #0b1020 0%, #111827 100%)",
          color: "#f8fafc",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(245, 158, 11, 0.45)",
              background: "rgba(245, 158, 11, 0.12)",
              color: "#fbbf24",
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 4,
            }}
          >
            AP
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: "#fbbf24" }}>
              Trust Registry / Stellar
            </div>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>
              AgentPassport
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 920 }}>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.08 }}>
            Payment-backed reputation for AI agents
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.35, color: "#cbd5e1" }}>
            Verified paid interactions, live Soroban state, and machine-readable docs for humans and agents.
          </div>
        </div>
      </div>
    ),
    size
  );
}
