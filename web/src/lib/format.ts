const STROOPS_PER_XLM = 10_000_000n;

export function getScoreToneClass(score: number): string {
  if (score >= 80) {
    return "border-accent/30 bg-accent/15 text-accent shadow-[0_0_10px_rgba(245,158,11,0.15)]";
  }

  if (score >= 40) {
    return "border-amber-500/30 bg-amber-500/12 text-amber-300";
  }

  return "border-red-500/30 bg-red-500/12 text-red-400";
}

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
  if (!/^\d+(\.\d+)?$/.test(stroops)) return "0 XLM";
  const value = stroops.includes(".")
    ? BigInt(Math.floor(Number(stroops)))
    : BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const fraction = value % STROOPS_PER_XLM;

  if (fraction === 0n) {
    return `${whole.toString()} XLM`;
  }

  const fractionString = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionString} XLM`;
}
