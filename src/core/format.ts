// tr-TR para formatlama & parse. Para giriş = numeric, para çıkış = formatlı.
// Bu modül framework'ten bağımsızdır (RN + Edge Function birlikte kullanır).

/** "₺18.400" — tam lira gösterimi. */
export function formatTRY(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return "₺" + Math.round(value).toLocaleString("tr-TR");
}

/** "₺18.400,00" — kuruş hassasiyeti gereken yerde. */
export function formatTRY2(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return (
    "₺" +
    value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** "%4,25" — aylık orandan (0.0425). */
export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  return "%" + (rate * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * tr-TR para string'ini sayıya çevir.
 * "18.400", "18.400,50", "18400", "₺18.400", "1.234.567,89" kabul eder.
 * Sayısal içerik yoksa null döner.
 */
export function parseTRYInput(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (cleaned === "") return null;
  // Türkçe: "." binlik ayracı, "," ondalık ayracı.
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Aylık faiz YÜZDE girişini ("3,75" veya "3.75") ONDALIK orana çevirir (0.0375).
 * Para parser'ından AYRIDIR: kullanıcı yüzde yazar, biz oranı saklarız.
 * Hem virgül hem nokta ondalık ayracı kabul edilir.
 */
export function parseMonthlyPercentInput(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (cleaned === "") return null;
  // Tek bir ondalık ayracı varsayımı: hem "," hem "." ondalık kabul edilir (yüzde, binlik yok).
  const normalized = cleaned.replace(",", ".");
  const pct = Number(normalized);
  if (!Number.isFinite(pct)) return null;
  return pct / 100;
}

/** Ondalık aylık oranı ("0.0375") yüzde giriş metnine çevirir ("3,75"). */
export function formatRateForInput(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "";
  const pct = Number((rate * 100).toFixed(4));
  return String(pct).replace(".", ",");
}
