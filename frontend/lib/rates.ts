// Free ECB rates via frankfurter.app — no API key, CORS-enabled.
// Falls back to a static approximation when offline.

const FALLBACK_USD_INR = 96.23;

let cached: Promise<number> | null = null;

export function getUsdInrRate(): Promise<number> {
  if (!cached) {
    cached = fetch("https://api.frankfurter.app/latest?from=USD&to=INR")
      .then((r) => r.json())
      .then((j) => (typeof j?.rates?.INR === "number" ? j.rates.INR : FALLBACK_USD_INR))
      .catch(() => FALLBACK_USD_INR);
  }
  return cached;
}

/** Convert an amount between INR and USD. Unknown currencies pass through unchanged. */
export function convert(
  amount: number,
  from: string | null,
  to: "INR" | "USD",
  usdInr: number
): number {
  if (!from || from === to) return amount;
  if (from === "USD" && to === "INR") return amount * usdInr;
  if (from === "INR" && to === "USD") return amount / usdInr;
  return amount; // other currencies shown at face value
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}
