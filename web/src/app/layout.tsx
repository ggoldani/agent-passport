import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPassport Dashboard",
  description: "Public trust registry for payment-backed agent reputation on Stellar"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="topbar-mark">
              <p className="topbar-kicker">Trust Registry / Stellar Testnet</p>
              <a className="brand" href="/">
                AgentPassport
              </a>
            </div>
            <p className="topbar-copy">
              Public reputation records derived from verified paid interactions.
            </p>
          </header>
          <main className="page-frame">{children}</main>
        </div>
      </body>
    </html>
  );
}
