const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_RE.test(address);
}

export function getApiUrl(): string {
  const url = process.env.AGENTPASSPORT_API_URL || "http://localhost:3002";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`Invalid AGENTPASSPORT_API_URL: ${url}. Must start with http:// or https://`);
  }
  return url.replace(/\/+$/, "");
}

export async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text().catch(() => "unknown error");
      throw new Error(`API error ${res.status}: ${body}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `AgentPassport API unreachable at ${baseUrl}. Start the API server or set AGENTPASSPORT_API_URL.`
      );
    }
    throw error;
  }
}
