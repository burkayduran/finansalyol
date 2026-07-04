// Payment occurrence istemci servisi: üretim (ensure) + atomik ödeme/geri alma (RPC).
import { supabase } from "./supabase";
import type { Debt, Payment, PaymentOccurrence } from "./database.types";
import {
  generateNextOccurrencesForDebt,
  recalculateOccurrenceStatus,
  type DebtForOcc,
} from "@/core/paymentOccurrences";

const MONTHS_AHEAD = 12;

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
  paidAt: string; // YYYY-MM-DD (yerel)
  note?: string;
}

/** Ödeme kaydet — tek atomik RPC (payments + occurrence + borç bakiyesi/kalan taksit). */
export async function recordPayment(input: RecordPaymentInput): Promise<void> {
  const { householdId, debt, occurrence, amount, paidAt, note } = input;
  const { error } = await supabase.rpc("record_payment", {
    p_household: householdId,
    p_debt: debt.id,
    p_occurrence: occurrence?.id ?? null,
    p_amount: amount,
    p_paid_at: paidAt,
    p_note: note || null,
  });
  if (error) throw error;
}

/** Ödemeyi geri al — tek atomik RPC (payment işaretle + occurrence + borç geri). */
export async function reversePayment(payment: Payment, _debt?: Debt): Promise<void> {
  const { error } = await supabase.rpc("reverse_payment", { p_payment: payment.id });
  if (error) throw error;
}

/** Occurrence'ı "ödeme gerekmiyor" olarak işaretle. */
export async function skipOccurrence(id: string): Promise<void> {
  await supabase.from("payment_occurrences").update({ status: "skipped" }).eq("id", id);
}
