// BDDK asgari ödeme hesabı (§3, §8). Bu KURAL'dır, tahmin değildir.
// Asgari tieri = KART LİMİTİ bazlı (faiz tieri ile karıştırma — o dönem borcu bazlı).

import type { Debt } from "./types";

export const BDDK_LIMIT_THRESHOLD = 50000;
export const BDDK_RATE_LOW = 0.2; // limit ≤ 50.000 ₺
export const BDDK_RATE_HIGH = 0.4; // limit > 50.000 ₺

/** Karta uygulanan BDDK asgari oranı (limit bazlı). */
export function bddkMinimumRate(cardLimit: number): number {
  return cardLimit > BDDK_LIMIT_THRESHOLD ? BDDK_RATE_HIGH : BDDK_RATE_LOW;
}

/**
 * Bir borç için bu ay ödenmesi gereken minimum (zorunlu) tutar.
 *  - Kredi kartı: BDDK oranı × dönem borcu (limit tier'ına göre).
 *  - Kredi: taksit tutarı (varsa).
 *  - KMH: regüle asgarisi YOK -> 0 (her zaman EKSTRA hedefi, zorunlu değil).
 * Kullanıcı tanımlı minimum (userMinimum) varsa onu taban alır.
 */
export function mandatoryMinimum(debt: Debt): number {
  let base = 0;

  if (debt.type === "credit_card" && debt.cardLimit != null) {
    const rate = bddkMinimumRate(debt.cardLimit);
    // Asgari, dönem borcunu aşamaz.
    base = Math.min(debt.balance, debt.balance * rate);
  } else if (debt.type === "loan" && debt.installment != null) {
    base = Math.min(debt.balance, debt.installment);
  } else if (debt.type === "kmh") {
    base = 0;
  }

  if (debt.userMinimum != null && debt.userMinimum > base) {
    base = Math.min(debt.balance, debt.userMinimum);
  }

  return base;
}

/** İnsan-okur "neden" gerekçesi — motordan üretilir, elle yazılmaz (§5). */
export function minimumReason(debt: Debt): string {
  if (debt.type === "credit_card") {
    return "Asgari ödeme — gecikme riskini önler";
  }
  if (debt.type === "loan") {
    return "Taksit ödemesi";
  }
  return "KMH — zorunlu asgarisi yok";
}
