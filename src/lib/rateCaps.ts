// Güncel faiz oran tablosu (Supabase rate_caps) istemci okuması.
// Veri yoksa/hata olursa boş döner → core resolveMonthlyRate kod-içi fallback'e düşer.
import { supabase } from "./supabase";
import type { RateCap } from "@/core/rateConfig";

export async function fetchRateCaps(): Promise<RateCap[]> {
  const { data, error } = await supabase
    .from("rate_caps")
    .select("debt_kind, min_amount, max_amount, monthly_rate, effective_date");
  if (error || !data) return [];
  return data.map((r) => ({
    debtKind: r.debt_kind,
    minAmount: r.min_amount,
    maxAmount: r.max_amount,
    monthlyRate: Number(r.monthly_rate),
    effectiveDate: r.effective_date,
  }));
}
