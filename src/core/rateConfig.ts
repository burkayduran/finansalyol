// APR fallback config. Seed'li tablo, admin UI yok.
// İç prensip: "tavan ≠ gerçek" — ekrana yazılmaz ama hesapta uygulanır.
// BETA: TCMB oranı değişince bu tablo ELLE güncellenmeli.
//
// Önemli ayrım:
//   - Faiz tieri  = DÖNEM BORCU bazlı (TCMB azami/tavan oran)  -> bu dosya
//   - Asgari tieri = KART LİMİTİ bazlı (BDDK %20/%40)          -> minimum.ts
// İki ayrı sistem, karıştırma.

export type DebtKind = "credit_card" | "kmh" | "loan";

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
  if (kind === "kmh") return CASH_ADVANCE_KMH_RATE;
  if (kind === "credit_card") {
    const tier = CREDIT_CARD_PURCHASE_TIERS.find(
      (t) => balance > (t.minStatementDebt ?? 0) && balance <= (t.maxStatementDebt ?? Infinity)
    );
    return tier?.monthlyRate ?? CASH_ADVANCE_KMH_RATE;
  }
  // Kredi: kendi akdi oranını taşır; bilinmiyorsa düşük tier (overstate etme).
  return CREDIT_CARD_PURCHASE_TIERS[0].monthlyRate;
}

export type RateSource = "user" | "tcmb_cap";

export interface ResolvedRate {
  monthlyRate: number;
  source: RateSource;
}

/**
 * Kullanıcı oranı varsa fallback'i EZER. Kaynak döner ki UI küçük "≈ tahmini"
 * notunu doğru göstersin.
 */
export function resolveMonthlyRate(
  kind: DebtKind,
  balance: number,
  userMonthlyRate?: number | null
): ResolvedRate {
  if (userMonthlyRate != null && userMonthlyRate > 0) {
    return { monthlyRate: userMonthlyRate, source: "user" };
  }
  return { monthlyRate: tcmbCapRate(kind, balance), source: "tcmb_cap" };
}
