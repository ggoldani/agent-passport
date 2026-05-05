import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const STATIC_ROUTES = [
  "/",
  "/agents",
  "/docs",
  "/docs.md",
  "/register",
  "/skills",
  "/SKILL.md",
  "/mcp",
  "/llms.txt",
  "/.well-known/llms.txt",
] as const;

type ApiAgent = {
  owner_address: string;
  created_at?: number;
};

async function fetchAgentUrls(): Promise<MetadataRoute.Sitemap> {
  const apiBase = process.env.API_URL ?? "http://localhost:3002";
  try {
    const response = await fetch(`${apiBase}/agents?limit=100&sort=score&order=desc`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { data?: ApiAgent[] };
    return (payload.data ?? [])
      .filter((agent) => Boolean(agent.owner_address))
      .map((agent) => ({
        url: absoluteUrl(`/agents/${agent.owner_address}`),
        changeFrequency: "daily" as const,
        priority: 0.7,
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : route === "/agents" ? 0.9 : 0.7,
  }));

  const agentEntries = await fetchAgentUrls();

  return [...staticEntries, ...agentEntries];
}
