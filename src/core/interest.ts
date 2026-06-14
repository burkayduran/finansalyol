// Faiz tahmini & asgari-tuzağı simülasyonu (§3, §5.3 referansı).
// Dil her zaman "yaklaşık / tavan orana göre" — kesin kazanç iddiası YOK.

import { resolveMonthlyRate } from "./rateConfig";
import { mandatoryMinimum } from "./minimum";
import type { Debt } from "./types";

/** Bir aylık tahmini faiz yükü (kalan bakiye × aylık oran). */
export function monthlyInterest(balance: number, monthlyRate: number): number {
  return balance * monthlyRate;
}

export type TrapVerdict = "shrinks" | "barely_shrinks" | "not_shrinking" | "growing";

export interface MinimumTrapResult {
  verdict: TrapVerdict;
  /** Sadece asgari ödenirse bir sonraki ay tahakkuk eden faiz. */
  nextMonthInterest: number;
  /** Asgari ödemenin anapara azaltan kısmı (negatifse borç büyür). */
  principalReduction: number;
}

/**
 * "Sadece asgari ödersen ne olur?" — suçlamadan, olduğu gibi (§3 Kart 2).
 * Tahmini faiz, asgari ödemenin anaparaya etkisiyle karşılaştırılır.
 */
export function minimumTrap(debt: Debt): MinimumTrapResult {
  const { monthlyRate } = resolveMonthlyRate(debt);
  const minimum = mandatoryMinimum(debt);
  const interest = monthlyInterest(debt.balance, monthlyRate);
  const principalReduction = minimum - interest;

  let verdict: TrapVerdict;
  if (principalReduction <= 0) {
    // Asgari faizi bile karşılamıyor -> borç büyür.
    verdict = principalReduction < 0 ? "growing" : "not_shrinking";
  } else if (principalReduction < debt.balance * 0.02) {
    // Anapara çok yavaş eriyor (aylık <%2).
    verdict = "barely_shrinks";
  } else {
    verdict = "shrinks";
  }

  return { verdict, nextMonthInterest: interest, principalReduction };
}

/**
 * Ekstra ödemenin kaçınılan faiz etkisi (yaklaşık, tek ay, tavan orana göre).
 * Ekstra tutar doğrudan anaparayı düşürür -> o tutar üstünden faiz işlemez.
 */
export function avoidedInterestFromExtra(debt: Debt, extra: number): number {
  const { monthlyRate } = resolveMonthlyRate(debt);
  const applied = Math.min(extra, debt.balance);
  return applied * monthlyRate;
}
