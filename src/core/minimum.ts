// BDDK asgari ödeme hesabı. Bu KURAL'dır, tahmin değildir.
// Asgari tieri = KART LİMİTİ bazlı (faiz tieri ile karıştırma — o dönem borcu bazlı).

import type { DebtKind } from "./rateConfig";

export const BDDK_LIMIT_THRESHOLD = 50000;
export const BDDK_RATE_LOW = 0.2; // limit ≤ 50.000 ₺
export const BDDK_RATE_HIGH = 0.4; // limit > 50.000 ₺

/** Karta uygulanan BDDK asgari oranı (limit bazlı). */
export function bddkMinimumRate(cardLimit: number): number {
  return cardLimit > BDDK_LIMIT_THRESHOLD ? BDDK_RATE_HIGH : BDDK_RATE_LOW;
}

export interface MinimumInput {
  kind: DebtKind;
  balance: number;
  cardLimit?: number | null;
  installment?: number | null;
  userMinimum?: number | null;
}

/**
 * Bir borç için bu ay ödenmesi gereken minimum (zorunlu) tutar.
 *  - Kredi kartı: BDDK oranı × dönem borcu (limit tier'ına göre).
 *  - Kredi: taksit tutarı (varsa).
 *  - KMH: regüle asgarisi YOK -> 0.
 * Kullanıcı tanımlı minimum varsa onu taban alır.
 */
export function mandatoryMinimum(input: MinimumInput): number {
  let base = 0;
  if (input.kind === "credit_card" && input.cardLimit != null) {
    base = Math.min(input.balance, input.balance * bddkMinimumRate(input.cardLimit));
  } else if (
    (input.kind === "loan" || input.kind === "installment_kmh") &&
    input.installment != null
  ) {
    // Taksitli KMH, kredi gibi davranır: zorunlu = taksit.
    base = Math.min(input.balance, input.installment);
  } else if (input.kind === "kmh") {
    base = 0; // normal/rotatif KMH: regüle asgarisi yok
  }
  if (input.userMinimum != null && input.userMinimum > base) {
    base = Math.min(input.balance, input.userMinimum);
  }
  return base;
}
