// tr-TR money formatting & parsing. Money in = numeric, money out = formatted.

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const tryFormatter2 = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "₺18.400" — whole-lira display used across the flow. */
export function formatTRY(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return tryFormatter.format(Math.round(value));
}

/** "₺18.400,00" — used where kuruş precision matters. */
export function formatTRY2(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return tryFormatter2.format(value);
}

/** "%4,25" from a monthly rate like 0.0425. */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  const pct = rate * 100;
  return `%${pct.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

/**
 * Parse a tr-TR money string into a number.
 * Accepts "18.400", "18.400,50", "18400", "₺18.400", "1.234.567,89".
 * Returns null when nothing numeric is present.
 */
export function parseTRYInput(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (cleaned === "") return null;

  // Turkish convention: "." = thousands separator, "," = decimal separator.
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
