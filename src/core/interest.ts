// Faiz tahmini & asgari-tuzağı içgörüsü (F1 — borcun içinde isteğe bağlı sekme).
// Dil sıcak ve az; iç prensip "tavan ≠ gerçek" hesapta uygulanır, ekrana yazılmaz.

import { resolveMonthlyRate, type DebtKind, type RateCap, type RateSource } from "./rateConfig";
import { mandatoryMinimum } from "./minimum";

export interface InsightInput {
  kind: DebtKind;
  balance: number;
  cardLimit?: number | null;
  installment?: number | null;
  userMinimum?: number | null;
  userMonthlyRate?: number | null;
  /** Dinamik oran tablosu (Supabase rate_caps); yoksa kod-içi fallback. */
  caps?: RateCap[];
}

export type TrapVerdict = "shrinks" | "barely_shrinks" | "not_shrinking" | "growing";

export interface MinimumTrap {
  verdict: TrapVerdict;
  /** Sadece asgari ödenirse bir sonraki ay tahakkuk eden tahmini faiz. */
  nextMonthInterest: number;
  /** Asgari ödemenin anapara azaltan kısmı (negatifse borç büyür). */
  principalReduction: number;
  /** Kullanılan aylık oran ve kaynağı (≈ tahmini rozeti için). */
  monthlyRate: number;
  rateSource: RateSource;
  rateIsEstimate: boolean;
}

/** Bir aylık tahmini faiz yükü (kalan bakiye × aylık oran). */
export function monthlyInterest(balance: number, monthlyRate: number): number {
  return balance * monthlyRate;
}

/** "Sadece asgarisini ödersen ne olur?" — sıcak, suçlamasız. */
export function minimumTrap(input: InsightInput): MinimumTrap {
  const { monthlyRate, source } = resolveMonthlyRate(
    input.kind,
    input.balance,
    input.userMonthlyRate,
    input.caps
  );
  const minimum = mandatoryMinimum(input);
  const interest = monthlyInterest(input.balance, monthlyRate);
  const principalReduction = minimum - interest;

  let verdict: TrapVerdict;
  if (principalReduction <= 0) {
    verdict = principalReduction < 0 ? "growing" : "not_shrinking";
  } else if (principalReduction < input.balance * 0.02) {
    verdict = "barely_shrinks";
  } else {
    verdict = "shrinks";
  }

  return {
    verdict,
    nextMonthInterest: interest,
    principalReduction,
    monthlyRate,
    rateSource: source,
    rateIsEstimate: source !== "user",
  };
}

/**
 * "Bu ay biraz fazlasını ayırırsan ne kazanırsın?" — ekstra ödemenin kaçınılan
 * faizi (yaklaşık, tek ay, tavan orana göre).
 */
export function avoidedInterestFromExtra(input: InsightInput, extra: number): number {
  const { monthlyRate } = resolveMonthlyRate(input.kind, input.balance, input.userMonthlyRate, input.caps);
  return Math.min(extra, input.balance) * monthlyRate;
}
