const STROOPS_PER_XLM = 10_000_000n;

export function formatAddressCompact(address: string): string {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function formatUtcTimestamp(timestamp: string | null): string {
  if (timestamp === null) {
    return "No verified records";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return `${formatted} UTC`;
}

export function formatXlmAmount(stroops: string): string {
  const value = BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const fraction = value % STROOPS_PER_XLM;

  if (fraction === 0n) {
    return `${whole.toString()} XLM`;
  }

  const fractionString = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionString} XLM`;
}
