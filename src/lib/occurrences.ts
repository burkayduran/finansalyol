// Payment occurrence istemci servisi: üretim (ensure), ödeme kaydetme, durum.
import { supabase } from "./supabase";
import type { Debt, PaymentOccurrence } from "./database.types";
import {
  generateNextOccurrencesForDebt,
  recalculateOccurrenceStatus,
  debtCurrentBalance,
  debtInstallment,
  type DebtForOcc,
} from "@/core/paymentOccurrences";
import { installmentsCoveredByPayment } from "@/core/installment";

const MONTHS_AHEAD = 12;

function addMonthsISO(dateISO: string, n: number): string {
  const d = new Date(dateISO);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return t.toISOString().slice(0, 10);
}

/**
 * Aktif borçlar için beklenen ödeme olaylarını üretip ekler (idempotent).
 * Unique index (debt_id, due_date, kind) sayesinde mevcutların üzerine yazmaz.
 */
export async function ensureOccurrences(householdId: string, debts: Debt[]): Promise<void> {
  const drafts = debts
    .filter((d) => d.is_active !== false)
    .flatMap((d) => generateNextOccurrencesForDebt(d as DebtForOcc, MONTHS_AHEAD))
    .map((o) => ({ ...o, household_id: householdId }));
  if (drafts.length === 0) return;
  await supabase
    .from("payment_occurrences")
    .upsert(drafts, { onConflict: "debt_id,due_date,kind", ignoreDuplicates: true });

  // Geçmiş & ödenmemiş occurrence'ları overdue'ya çek (status tazele).
  await refreshOverdue(householdId);
}

async function refreshOverdue(householdId: string): Promise<void> {
  const { data } = await supabase
    .from("payment_occurrences")
    .select("*")
    .eq("household_id", householdId)
    .in("status", ["pending", "partial"]);
  for (const o of data ?? []) {
    const next = recalculateOccurrenceStatus(o);
    if (next !== o.status) {
      await supabase.from("payment_occurrences").update({ status: next }).eq("id", o.id);
    }
  }
}

export interface RecordPaymentInput {
  householdId: string;
  debt: Debt;
  occurrence?: PaymentOccurrence | null;
  amount: number;
  paidAt: string; // ISO
  note?: string;
}

/** Ödeme kaydet: payments + occurrence + borç bakiyesi/kalan taksit güncelle. */
export async function recordPayment(input: RecordPaymentInput): Promise<void> {
  const { householdId, debt, occurrence, amount, paidAt, note } = input;

  await supabase.from("payments").insert({
    household_id: householdId,
    debt_id: debt.id,
    occurrence_id: occurrence?.id ?? null,
    owner_type: debt.owner_type,
    person_id: debt.person_id,
    amount,
    paid_at: paidAt,
    note: note || null,
  });

  if (occurrence) {
    const amount_paid = Number(occurrence.amount_paid) + amount;
    const status = recalculateOccurrenceStatus({
      due_date: occurrence.due_date,
      amount_due: occurrence.amount_due,
      amount_paid,
    });
    await supabase.from("payment_occurrences").update({ amount_paid, status }).eq("id", occurrence.id);
  }

  // Borç güncelle.
  const curBal = debtCurrentBalance(debt as DebtForOcc);
  const newBal = Math.max(0, curBal - amount);
  const patch: Record<string, unknown> = { current_balance: newBal, balance: newBal };

  if (debt.kind === "loan" || debt.kind === "installment_kmh") {
    const inst = debtInstallment(debt as DebtForOcc);
    // Çoklu taksit: ödenen tutar kaç tam taksit karşılıyor?
    if (inst > 0 && amount >= inst) {
      const paidInstallments = installmentsCoveredByPayment(amount, inst);
      const prevRem = debt.remaining_installment_count ?? debt.term_count ?? 0;
      const rem = Math.max(0, prevRem - paidInstallments);
      patch.remaining_installment_count = rem;
      if (debt.next_due_date) patch.next_due_date = addMonthsISO(debt.next_due_date, paidInstallments);
      if (rem === 0) patch.is_active = false;
    }
    // amount < taksit ise yalnız bakiye düşer (occurrence partial olur, yukarıda işlenir).
  }
  await supabase.from("debts").update(patch as never).eq("id", debt.id);
}

/** Occurrence'ı "ödeme gerekmiyor" olarak işaretle. */
export async function skipOccurrence(id: string): Promise<void> {
  await supabase.from("payment_occurrences").update({ status: "skipped" }).eq("id", id);
}
