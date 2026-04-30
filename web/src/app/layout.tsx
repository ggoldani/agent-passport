import type { Metadata } from "next";
import "./globals.css";

const DEMO_CONTRACT_ID = "CCIK4FM4PM7SXYFPBBTG5NCMH5TWCKHHK75RZSKUU5GA27UVLS572U7F";
const DEMO_PROVIDER_ADDRESS = "GC7TRXR2SJ7644453S5BR755L5M2OSUFIFOEAYGEPMUOKLPFI6HEKOPT";

export const metadata: Metadata = {
  title: "AgentPassport",
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
            <div className="topbar-brand">
              <div className="topbar-seal" aria-hidden="true">
                <span>AP</span>
              </div>
              <div className="topbar-mark">
                <p className="topbar-kicker">Trust Registry / Stellar Testnet</p>
                <a className="brand" href="/">
                  AgentPassport
                </a>
              </div>
            </div>
            <div className="topbar-nav">
              <p className="topbar-copy">
                Public reputation records derived from verified paid interactions.
              </p>
              <a className="footer-link topbar-nav-link" href="/agents">
                Explore
              </a>
              <a className="footer-link topbar-nav-link" href="/docs">
                Docs
              </a>
              <a className="footer-link topbar-nav-link" href="/register">
                Register Agent
              </a>
            </div>
          </header>
          <main className="page-frame">{children}</main>
          <footer className="footer-bar">
            <a
              className="footer-link"
              href={`https://stellar.expert/explorer/testnet/contract/${DEMO_CONTRACT_ID}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              Testnet contract
            </a>
            <a
              className="footer-link"
              href={`https://stellar.expert/explorer/testnet/account/${DEMO_PROVIDER_ADDRESS}`}
              rel="noreferrer noopener"
              target="_blank"
            >
              Demo provider
            </a>
            <a
              className="footer-link"
              href="/register"
            >
              Register agent
            </a>
            <a
              className="footer-link"
              href="/docs"
            >
              Docs
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
