import type { Metadata } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { StructuredData } from "@/components/StructuredData";
import { OG_IMAGE_PATH, SITE_DESCRIPTION, SITE_NAME, SITE_URL_OBJECT } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AgentPassport",
  description: SITE_DESCRIPTION,
  metadataBase: SITE_URL_OBJECT,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <StructuredData />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
