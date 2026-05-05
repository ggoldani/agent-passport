import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";

function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function StructuredData() {
  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: absoluteUrl("/agents?q={search_term_string}"),
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
    },
  ];

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />;
}
