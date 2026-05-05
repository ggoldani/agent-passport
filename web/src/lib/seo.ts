import type { Metadata } from "next";

export const SITE_NAME = "AgentPassport";
export const SITE_DESCRIPTION = "Public trust registry for payment-backed agent reputation on Stellar";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_URL_OBJECT = new URL(SITE_URL);
export const OG_IMAGE_PATH = "/opengraph-image";

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL_OBJECT).toString();
}

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: "website" | "article";
};

export function buildPageMetadata({
  title,
  description,
  path,
  noindex = false,
  type = "website",
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: path,
      },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      type,
      images: [
        {
          url: OG_IMAGE_PATH,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
    robots: noindex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
          },
        },
  };
}
