const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function validateStellarAddress(address: string): void {
  if (!STELLAR_ADDRESS_RE.test(address)) {
    if (!address.startsWith("G")) {
      throw new Error(
        `"${address}" is not a valid Stellar public key. Stellar addresses start with "G" followed by 56 characters (e.g., GBVDQYSFGXEACZD7LG3NI7UAGLOP72D5SDDNJTHHWHD5EYDZHTPLG2IR). Make sure you're passing the agent's public key, not a secret key or contract ID.`
      );
    }
    throw new Error(
      `"${address}" looks like a Stellar address but has the wrong length (got ${address.length}, expected 56). Stellar public keys are 56 characters starting with "G" (e.g., GBVDQYSFGXEACZD7LG3NI7UAGLOP72D5SDDNJTHHWHD5EYDZHTPLG2IR). Double-check the address and try again.`
    );
  }
}

export function getApiUrl(): string {
  const url = process.env.AGENTPASSPORT_API_URL || "http://localhost:3002";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(
      `AGENTPASSPORT_API_URL must be a valid URL starting with "http://" or "https://". Got: "${url}".`
    );
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
      if (res.status === 404) {
        throw new Error(
          `No agent found at this address. The agent may not be registered on AgentPassport yet, or the address might be incorrect. You can search for registered agents using the agent_search tool.`
        );
      }
      if (res.status === 429) {
        throw new Error(
          `Too many requests — the AgentPassport API is rate-limiting this client. Wait a moment and try again.`
        );
      }
      if (res.status >= 500) {
        throw new Error(
          `The AgentPassport API server encountered an internal error (HTTP ${res.status}). This is not your fault — try again in a few moments. If it persists, check the AgentPassport status page or server logs.`
        );
      }
      throw new Error(
        `The AgentPassport API returned an error (HTTP ${res.status}): ${body.slice(0, 200)}`
      );
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Could not reach the AgentPassport API at ${baseUrl}. Make sure the API server is running and accessible. If you're running it locally, start it with "npm run start:api" from the project root. You can also set AGENTPASSPORT_API_URL to point to a different server.`
      );
    }
    throw error;
  }
}
