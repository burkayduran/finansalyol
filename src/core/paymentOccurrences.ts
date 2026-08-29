// Beklenen ödeme olayları (payment occurrence) motoru.
// Borçlardan, ödenmesi beklenen ödeme olaylarını üretir; durum hesaplar.
// Saf & test edilebilir; DB'ye bağlı değil.

import { bddkMinimumRate } from "./minimum";
import { toISODateLocal, parseISODateLocal } from "./dates";
import type { DebtKind } from "./rateConfig";

export type OccStatus = "pending" | "partial" | "paid" | "overdue" | "skipped";
export type OccKind =
  | "credit_card_minimum"
  | "loan_installment"
  | "installment_kmh"
  | "kmh_manual"
  | "custom";

/** Yeni alan adları öncelikli; eski alanlar geriye uyum için fallback. */
export interface DebtForOcc {
  id: string;
  kind: DebtKind;
  owner_type?: "person" | "household" | null;
  person_id?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  bank?: string | null;
  label?: string | null;
  current_balance?: number | null;
  balance?: number | null;
  card_limit?: number | null;
  user_minimum_payment?: number | null;
  user_minimum?: number | null;
  monthly_installment?: number | null;
  installment?: number | null;
  remaining_installment_count?: number | null;
  total_installment_count?: number | null;
  next_due_date?: string | Date | null;
  first_installment_date?: string | Date | null;
  due_day?: number | null;
  is_active?: boolean | null;
}

export interface PaymentOccurrenceDraft {
  debt_id: string;
  owner_type: "person" | "household";
  person_id: string | null;
  due_date: string; // ISO (YYYY-MM-DD)
  amount_due: number;
  kind: OccKind;
  installment_no: number | null;
  total_installments: number | null;
  bank_code: string | null;
  bank_name: string | null;
  label: string | null;
}

const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

export const debtCurrentBalance = (d: DebtForOcc): number =>
  num(d.current_balance) ?? num(d.balance) ?? 0;
export const debtInstallment = (d: DebtForOcc): number =>
  num(d.monthly_installment) ?? num(d.installment) ?? 0;
export const debtRemaining = (d: DebtForOcc): number | null =>
  num(d.remaining_installment_count) ?? num(d.total_installment_count) ?? null;

function asDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : parseISODateLocal(v);
  return isNaN(d.getTime()) ? null : d;
}
const iso = (d: Date) => toISODateLocal(d);
function addMonthsClamped(base: Date, n: number): Date {
  const day = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function nextDueFromDay(dueDay: number, today: Date): Date {
  const clamp = (y: number, m: number) => Math.min(dueDay, new Date(y, m + 1, 0).getDate());
  let t = new Date(today.getFullYear(), today.getMonth(), clamp(today.getFullYear(), today.getMonth()));
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (t < t0) t = new Date(today.getFullYear(), today.getMonth() + 1, clamp(today.getFullYear(), today.getMonth() + 1));
  return t;
}

/** Bir borç için bu dönem zorunlu ödenmesi gereken tutar. */
export function getMandatoryAmountForDebt(d: DebtForOcc): number {
  const userMin = num(d.user_minimum_payment) ?? num(d.user_minimum);
  if (d.kind === "credit_card") {
    if (userMin != null && userMin > 0) return userMin;
    const limit = num(d.card_limit);
    if (limit == null) return 0;
    return debtCurrentBalance(d) * bddkMinimumRate(limit);
  }
  if (d.kind === "loan" || d.kind === "installment_kmh") {
    return debtInstallment(d);
  }
  // normal KMH: yalnız kullanıcı minimum tanımladıysa zorunlu
  return userMin != null && userMin > 0 ? userMin : 0;
}

/**
 * Borçtan, önümüzdeki `monthsAhead` ay için beklenen ödeme olaylarını üretir.
 * Kredi/taksitli KMH: kalan taksit + sıradaki ödeme tarihinden ilerler.
 * Kredi kartı: her ay due_day. Normal KMH: yalnız user_minimum varsa.
 */
export function generateNextOccurrencesForDebt(
  d: DebtForOcc,
  monthsAhead: number,
  today: Date = new Date()
): PaymentOccurrenceDraft[] {
  if (d.is_active === false) return [];

  const owner_type = (d.owner_type as "person" | "household") ?? (d.person_id ? "person" : "household");
  const meta = {
    debt_id: d.id,
    owner_type,
    person_id: d.person_id ?? null,
    bank_code: d.bank_code ?? null,
    bank_name: d.bank_name ?? d.bank ?? null,
    label: d.label ?? null,
  };
  const out: PaymentOccurrenceDraft[] = [];

  if (d.kind === "loan" || d.kind === "installment_kmh") {
    const installment = debtInstallment(d);
    const remaining = debtRemaining(d) ?? 0;
    const start = asDate(d.next_due_date) ?? asDate(d.first_installment_date);
    if (!start || installment <= 0 || remaining <= 0) return [];
    const total = num(d.total_installment_count);
    const count = Math.min(remaining, monthsAhead);
    for (let i = 0; i < count; i++) {
      const due = addMonthsClamped(start, i);
      const remainingNo = remaining - i; // bu ödemeden önce kalan
      out.push({
        ...meta,
        due_date: iso(due),
        amount_due: installment,
        kind: d.kind === "loan" ? "loan_installment" : "installment_kmh",
        installment_no: total != null ? total - remainingNo + 1 : null,
        total_installments: total,
      });
    }
    return out;
  }

  // credit_card & (mandatory) kmh: aylık tekrar
  const mandatory = getMandatoryAmountForDebt(d);
  if (mandatory <= 0) return [];
  const dueDay = d.due_day ?? 1;
  const first = nextDueFromDay(dueDay, today);
  for (let i = 0; i < monthsAhead; i++) {
    out.push({
      ...meta,
      due_date: iso(addMonthsClamped(first, i)),
      amount_due: mandatory,
      kind: d.kind === "credit_card" ? "credit_card_minimum" : "kmh_manual",
      installment_no: null,
      total_installments: null,
    });
  }
  return out;
}

/**
 * Türetilmiş (görsel) statü — gecikmenin TEK kaynağı.
 * Ham DB statüsü yalnız ödeme aksiyonlarıyla değişir; vade geçince pending/partial
 * kaydı burada `overdue` sayılır. Vade GÜNÜ henüz gecikme değildir.
 */
export function effectiveStatus(
  o: { status: OccStatus; due_date: string },
  today: Date = new Date()
): OccStatus {
  if (o.status === "pending" || o.status === "partial") {
    const due = parseISODateLocal(o.due_date);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (due < t) return "overdue"; // vade günü geçince; vade günü henüz gecikme değil
  }
  return o.status; // paid/skipped/overdue aynen
}

/** Occurrence durumunu yeniden hesapla (ödendi/kısmi/gecikmiş…). */
export function recalculateOccurrenceStatus(
  o: { due_date: string | Date; amount_due: number; amount_paid: number; status?: OccStatus },
  today: Date = new Date()
): OccStatus {
  if (o.status === "skipped") return "skipped";
  const due = asDate(o.due_date);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const paid = Number(o.amount_paid) || 0;
  const amountDue = Number(o.amount_due) || 0;

  if (amountDue > 0 && paid >= amountDue) return "paid";
  const pastDue = due != null && due < t0;
  if (pastDue) return "overdue";
  if (paid > 0) return "partial";
  return "pending";
}
