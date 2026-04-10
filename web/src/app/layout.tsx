import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPassport Dashboard",
  description: "Minimal trust dashboard for the AgentPassport MVP"
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
            <a className="brand" href="/">
              AgentPassport
            </a>
            <p className="topbar-copy">Minimal trust dashboard for the MVP demo flow.</p>
          </header>
          <main className="page-frame">{children}</main>
        </div>
      </body>
    </html>
  );
}
