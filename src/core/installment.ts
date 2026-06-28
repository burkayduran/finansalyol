// Taksitli borç (kredi + taksitli KMH) türetmeleri.
// loan/installment_kmh için kalan borç ELLE girilmez; toplam tutar + aylık taksit +
// taksit sayısı + ilk taksit tarihinden türetilir.

import type { DebtKind } from "./rateConfig";

/** Bugüne kadar ödenmiş taksit sayısı (0..termCount). İlk taksit dahildir. */
export function installmentsPaid(
  firstDate: Date,
  termCount: number,
  today: Date = new Date()
): number {
  const months =
    (today.getFullYear() - firstDate.getFullYear()) * 12 +
    (today.getMonth() - firstDate.getMonth()) +
    (today.getDate() >= firstDate.getDate() ? 1 : 0); // ilk taksit dahil
  return Math.max(0, Math.min(termCount, months));
}

/** Kalan borç = kalan taksit × aylık taksit. */
export function outstandingInstallment(
  d: { installment: number; termCount: number; firstInstallmentDate: Date },
  today: Date = new Date()
): number {
  const remaining = d.termCount - installmentsPaid(d.firstInstallmentDate, d.termCount, today);
  return Math.max(0, remaining) * d.installment;
}

/** Bir ödeme kaç tam taksit kapatır? (amount < taksit -> 0) */
export function installmentsCoveredByPayment(amount: number, monthlyInstallment: number): number {
  if (monthlyInstallment <= 0) return 0;
  return Math.floor(amount / monthlyInstallment);
}

/** Kalan taksit sayısı (0..termCount). */
export function installmentsRemaining(
  firstDate: Date,
  termCount: number,
  today: Date = new Date()
): number {
  return Math.max(0, termCount - installmentsPaid(firstDate, termCount, today));
}

export interface OutstandingDebt {
  kind: DebtKind;
  balance: number;
  installment?: number | null;
  termCount?: number | null;
  firstInstallmentDate?: Date | null;
}

/**
 * Borcun GERÇEK kalan bakiyesi.
 *  - credit_card / kmh  -> debt.balance (ham)
 *  - loan / installment_kmh -> outstandingInstallment(...)
 * Dashboard toplam borç, kişi kırılımı ve projeksiyon BUNU kullanır (ham balance değil).
 */
export function outstandingBalance(d: OutstandingDebt, today: Date = new Date()): number {
  if (
    (d.kind === "loan" || d.kind === "installment_kmh") &&
    d.installment != null &&
    d.termCount != null &&
    d.firstInstallmentDate != null
  ) {
    return outstandingInstallment(
      { installment: d.installment, termCount: d.termCount, firstInstallmentDate: d.firstInstallmentDate },
      today
    );
  }
  return d.balance;
}
