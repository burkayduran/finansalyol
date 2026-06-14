// Plan motoru — sıralama mantığı (§5, §6).
// İki AYRI blok. Karıştırma.
//   Blok A (zorunlu): kart asgarileri + kredi taksitleri + kullanıcı minimumları
//                     -> sıralama: son ödeme günü (artan), amaç: gecikmeyi önle
//   Blok B (ekstra):  kalan bütçe -> sıralama: SEÇİLEN STRATEJİ (tek anahtar)
//                     avalanche -> aylık oran (azalan)
//                     snowball  -> bakiye (artan)
//   KMH: regüle asgarisi yok -> her zaman EKSTRA hedefi, zorunlu değil.

import { mandatoryMinimum, minimumReason } from "./minimum";
import { resolveMonthlyRate } from "./rateConfig";
import { formatPercent } from "./format";
import type { Debt, ResolvedRate, Strategy } from "./types";

export interface MandatoryRow {
  debt: Debt;
  amount: number;
  reason: string;
}

export interface ExtraRow {
  debt: Debt;
  priority: number;
  rate: ResolvedRate;
  reason: string;
}

export interface MonthPlan {
  mandatory: MandatoryRow[];
  totalMandatory: number;
  extra: ExtraRow[];
  /** Ekstra bütçe (zorunlulardan artan + kullanıcı ekstrası). */
  extraBudget: number;
}

/** Blok A — zorunlu ödemeler, son ödeme gününe göre artan sırada. */
export function buildMandatory(debts: Debt[]): MandatoryRow[] {
  return debts
    .map((debt) => ({ debt, amount: mandatoryMinimum(debt), reason: minimumReason(debt) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => a.debt.dueDay - b.debt.dueDay);
}

/**
 * Blok B — ekstra ödeme önerisi, SEÇİLEN STRATEJİ tek sıralama anahtarı.
 * "Neden" metni motordan üretilir; gösterilen sıra ile gerekçe çelişemez (§5).
 */
export function buildExtra(debts: Debt[], strategy: Strategy): ExtraRow[] {
  const enriched = debts.map((debt) => ({ debt, rate: resolveMonthlyRate(debt) }));

  const sorted = [...enriched].sort((a, b) => {
    if (strategy === "avalanche") {
      // En yüksek aylık oran üste; eşitlikte büyük bakiye öne.
      if (b.rate.monthlyRate !== a.rate.monthlyRate) {
        return b.rate.monthlyRate - a.rate.monthlyRate;
      }
      return b.debt.balance - a.debt.balance;
    }
    // snowball: en küçük bakiye üste.
    if (a.debt.balance !== b.debt.balance) {
      return a.debt.balance - b.debt.balance;
    }
    return b.rate.monthlyRate - a.rate.monthlyRate;
  });

  return sorted.map((item, index) => ({
    debt: item.debt,
    priority: index + 1,
    rate: item.rate,
    reason: extraReason(item.rate, strategy, index === 0),
  }));
}

function extraReason(rate: ResolvedRate, strategy: Strategy, isTop: boolean): string {
  if (strategy === "avalanche") {
    const ratePart = `aylık oran (≈${formatPercent(rate.monthlyRate)})`;
    return isTop
      ? `En yüksek ${ratePart} — kalan borca en çok faiz burada`
      : `Sonraki en yüksek oranlı borç (${ratePart})`;
  }
  // snowball
  return isTop
    ? "En küçük bakiye — önce bunu kapatmak motivasyon ve nakit akışı sağlar"
    : "Sonraki en küçük bakiye";
}

/** Tüm aylık planı kur. */
export function buildMonthPlan(
  debts: Debt[],
  strategy: Strategy,
  userExtra: number = 0
): MonthPlan {
  const mandatory = buildMandatory(debts);
  const totalMandatory = mandatory.reduce((sum, row) => sum + row.amount, 0);
  const extra = buildExtra(debts, strategy);
  return { mandatory, totalMandatory, extra, extraBudget: Math.max(0, userExtra) };
}
