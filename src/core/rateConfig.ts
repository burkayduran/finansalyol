// APR fallback config (§7). Seed'li tablo, admin UI yok (0A).
// BETA: TCMB oranı değişince bu tablo ELLE güncellenmeli (admin UI 0B'de).
//
// Önemli ayrım (§8):
//   - Faiz tieri  = DÖNEM BORCU bazlı (TCMB azami/tavan oran)  -> bu dosya
//   - Asgari tieri = KART LİMİTİ bazlı (BDDK %20/%40)          -> minimum.ts
// İki ayrı sistem, karıştırma.

import type { Debt, ResolvedRate } from "./types";

export const RATE_SOURCE = {
  country: "TR",
  sourceName: "TCMB",
  sourceType: "maximum_cap" as const,
  effectiveDate: "2026-06-01",
  lastCheckedAt: "2026-06-14",
  userEditable: true,
} as const;

interface RateTier {
  /** Alt sınır dahil değil (exclusive). Atlanırsa 0 kabul edilir. */
  minStatementDebt?: number;
  /** Üst sınır dahil (inclusive). Atlanırsa +∞ kabul edilir. */
  maxStatementDebt?: number;
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
export function tcmbCapRate(debt: Debt): number {
  if (debt.type === "kmh") return CASH_ADVANCE_KMH_RATE;

  if (debt.type === "credit_card") {
    const tier = CREDIT_CARD_PURCHASE_TIERS.find((t) => {
      const aboveMin = debt.balance > (t.minStatementDebt ?? 0);
      const belowMax = debt.balance <= (t.maxStatementDebt ?? Infinity);
      return aboveMin && belowMax;
    });
    return tier?.monthlyRate ?? CASH_ADVANCE_KMH_RATE;
  }

  // Loans carry their own contractual rate. If unknown, we do NOT assume the
  // top cap (that would overstate cost and break "tavan ≠ gerçek"); we use the
  // lowest card tier as a conservative placeholder so KMH/cards rank above an
  // unknown-rate loan in avalanche. User can override with the real rate.
  return CREDIT_CARD_PURCHASE_TIERS[0].monthlyRate;
}

/**
 * Resolve the monthly rate for a debt. User override (user_editable) wins,
 * otherwise the TCMB cap is used. Source is returned so the UI can be honest
 * about "tavan ≠ gerçek" (§0, §8).
 */
export function resolveMonthlyRate(debt: Debt): ResolvedRate {
  if (debt.userMonthlyRate != null && debt.userMonthlyRate > 0) {
    return { monthlyRate: debt.userMonthlyRate, source: "user" };
  }
  return { monthlyRate: tcmbCapRate(debt), source: "tcmb_cap" };
}
