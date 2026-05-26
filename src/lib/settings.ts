// ── Currency & Units settings helpers ────────────────────────
// Used across the app for consistent formatting.

export type Currency = "EUR" | "USD" | "GBP" | "SEK";
export type Units    = "metric" | "imperial";

export const CURRENCIES: {
  code: Currency;
  symbol: string;
  label: string;
  shortLabel: string;
}[] = [
  { code: "EUR", symbol: "€",  label: "Euro",          shortLabel: "EUR" },
  { code: "USD", symbol: "$",  label: "US Dollar",     shortLabel: "USD" },
  { code: "GBP", symbol: "£",  label: "British Pound", shortLabel: "GBP" },
  { code: "SEK", symbol: "kr", label: "Swedish Krona", shortLabel: "SEK" },
];

/** Approximate fixed rates FROM EUR — good enough for display hints */
export const EUR_TO: Record<Currency, number> = {
  EUR: 1,
  USD: 1.09,
  GBP: 0.86,
  SEK: 11.50,
};

export function getCurrency(code: Currency) {
  return CURRENCIES.find(c => c.code === code)!;
}

/** Format a converted amount in the target currency */
export function formatConvertedAmount(eur: number, to: Currency): string {
  if (to === "EUR") return `€${eur % 1 === 0 ? eur.toFixed(0) : eur.toFixed(2)}`;
  const amount = eur * EUR_TO[to];
  const { symbol, code } = getCurrency(to);
  if (code === "SEK") return `${Math.round(amount)} ${symbol}`;
  return `${symbol}${amount % 1 === 0 ? Math.round(amount) : amount.toFixed(2)}`;
}

/**
 * Parse a pricing_info string and append "(~ X SEK)" after each €XX amount.
 * If `to === "EUR"` the text is returned unchanged.
 */
export function convertPricingText(text: string, to: Currency): string {
  if (to === "EUR") return text;
  const { symbol, code } = getCurrency(to);
  return text.replace(/€\s*(\d+(?:[.,]\d+)?)/g, (match, numStr) => {
    const eur = parseFloat(numStr.replace(",", "."));
    const amount = eur * EUR_TO[to];
    const fmt =
      code === "SEK"
        ? `${Math.round(amount)} ${symbol}`
        : `${symbol}${Math.round(amount)}`;
    return `${match} (~ ${fmt})`;
  });
}

/**
 * Format meters into the appropriate distance string for the chosen units.
 */
export function formatDistance(meters: number, units: Units): string {
  if (units === "imperial") {
    const ft = meters * 3.28084;
    if (ft < 528) return `${Math.round(ft)} ft`;          // < 0.1 mi
    const mi = meters / 1609.34;
    return `${mi.toFixed(1)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format a GPS accuracy radius the same way.
 * Returns e.g. "± 350 m" or "± 0.2 mi"
 */
export function formatAccuracy(meters: number, units: Units): string {
  return `± ${formatDistance(meters, units)}`;
}

/** Typical EUR spend range per budget level (price_level 1–4) */
export const BUDGET_RANGE_EUR: Record<number, [number, number] | null> = {
  1: [0, 20],
  2: [20, 50],
  3: [50, 100],
  4: [100, 999],
};

/** Return a human-readable budget range in the target currency */
export function formatBudgetRange(priceLevel: number, to: Currency): string | null {
  const range = BUDGET_RANGE_EUR[priceLevel];
  if (!range) return null;
  const [lo, hi] = range;
  const { symbol, code } = getCurrency(to);
  const conv = (n: number) => Math.round(n * EUR_TO[to]);
  if (hi === 999) {
    const loConv = conv(lo);
    return code === "SEK" ? `${loConv}+ ${symbol}` : `${symbol}${loConv}+`;
  }
  const loConv = conv(lo);
  const hiConv = conv(hi);
  return code === "SEK"
    ? `${loConv}–${hiConv} ${symbol}`
    : `${symbol}${loConv}–${symbol}${hiConv}`;
}
