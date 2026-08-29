// APR fallback config. Seed'li tablo, admin UI yok.
// İç prensip: "tavan ≠ gerçek" — ekrana yazılmaz ama hesapta uygulanır.
// BETA: TCMB oranı değişince bu tablo ELLE güncellenmeli.
//
// Önemli ayrım:
//   - Faiz tieri  = DÖNEM BORCU bazlı (TCMB azami/tavan oran)  -> bu dosya
//   - Asgari tieri = KART LİMİTİ bazlı (BDDK %20/%40)          -> minimum.ts
// İki ayrı sistem, karıştırma.

export type DebtKind = "credit_card" | "kmh" | "installment_kmh" | "loan";

export const RATE_SOURCE = {
  country: "TR",
  sourceName: "TCMB",
  sourceType: "maximum_cap" as const,
  effectiveDate: "2026-06-01",
  lastCheckedAt: "2026-06-14",
  userEditable: true,
} as const;

interface RateTier {
  minStatementDebt?: number; // exclusive
  maxStatementDebt?: number; // inclusive
  monthlyRate: number;
}

// Aylık azami akdi faiz — TCMB (1 Ocak 2026'dan beri geçerli yapı).
export const CREDIT_CARD_PURCHASE_TIERS: RateTier[] = [
  { maxStatementDebt: 30000, monthlyRate: 0.0325 },
  { minStatementDebt: 30000, maxStatementDebt: 180000, monthlyRate: 0.0375 },
  { minStatementDebt: 180000, monthlyRate: 0.0425 },
];

export const CASH_ADVANCE_KMH_RATE = 0.0425;

/** TCMB tavan oranı — dönem borcu (statement debt) bazlı tier seçimi. */
export function tcmbCapRate(kind: DebtKind, balance: number): number {
  if (kind === "kmh" || kind === "installment_kmh") return CASH_ADVANCE_KMH_RATE;
  if (kind === "credit_card") {
    const tier = CREDIT_CARD_PURCHASE_TIERS.find(
      (t) => balance > (t.minStatementDebt ?? 0) && balance <= (t.maxStatementDebt ?? Infinity)
    );
    return tier?.monthlyRate ?? CASH_ADVANCE_KMH_RATE;
  }
  // Kredi: kendi akdi oranını taşır; bilinmiyorsa düşük tier (overstate etme).
  return CREDIT_CARD_PURCHASE_TIERS[0].monthlyRate;
}

export type RateSource = "user" | "rate_table" | "tcmb_cap";

export interface ResolvedRate {
  monthlyRate: number;
  source: RateSource;
}

/**
 * Supabase `rate_caps` satırının saf (framework-bağımsız) biçimi.
 * min/max = dönem borcu aralığı (min exclusive, max inclusive).
 */
export interface RateCap {
  debtKind: DebtKind;
  minAmount?: number | null;
  maxAmount?: number | null;
  monthlyRate: number;
  effectiveDate?: string | null;
}

/**
 * Yanlış saklanmış eski oranları güvenli normalize eder (yüzde/oran karışıklığı).
 *   375  -> 0.0375  (yüzde*100 hatası)
 *   3.75 -> 0.0375  (yüzde saklanmış)
 *   0.0375 -> 0.0375 (zaten oran)
 */
export function normalizeStoredMonthlyRate(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  if (rate > 100) return rate / 10000;
  if (rate > 1) return rate / 100;
  return rate;
}

/** Dinamik oran tablosundan (rate_caps) eşleşen güncel oranı bul; yoksa null. */
export function capRateFromTable(kind: DebtKind, balance: number, caps: RateCap[]): number | null {
  const matches = caps.filter(
    (c) =>
      c.debtKind === kind &&
      balance > (c.minAmount ?? 0) &&
      balance <= (c.maxAmount ?? Infinity)
  );
  if (matches.length === 0) return null;
  // En güncel effective_date öncelikli.
  matches.sort((a, b) => (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""));
  return matches[0].monthlyRate;
}

/**
 * Kullanıcı oranı varsa fallback'i EZER. Sonra dinamik tablo (rate_caps),
 * o da yoksa kod-içi TCMB fallback. Kaynak döner ki UI doğru not göstersin.
 */
export function resolveMonthlyRate(
  kind: DebtKind,
  balance: number,
  userMonthlyRate?: number | null,
  caps?: RateCap[]
): ResolvedRate {
  const userRate = normalizeStoredMonthlyRate(userMonthlyRate);
  if (userRate != null && userRate > 0) {
    return { monthlyRate: userRate, source: "user" };
  }
  if (caps && caps.length > 0) {
    const fromTable = capRateFromTable(kind, balance, caps);
    if (fromTable != null) return { monthlyRate: fromTable, source: "rate_table" };
  }
  return { monthlyRate: tcmbCapRate(kind, balance), source: "tcmb_cap" };
}
