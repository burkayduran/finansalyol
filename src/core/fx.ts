// FX yardımcıları. Değerleme kuru = TCMB ALIŞ (forex_buying): elindeki dövizi
// bozdururken alınan taraf. Dil "≈ tahmini / TCMB kuru".

export interface FxRateLike {
  forex_buying: number | null;
  rate_date?: string;
}

/** 1 birim para birimi kaç TRY. TRY → 1; kur yoksa null. */
export function fxRate(currency: string, rates: Record<string, FxRateLike>): number | null {
  if (!currency || currency === "TRY") return 1;
  const r = rates[currency]?.forex_buying;
  return r != null ? Number(r) : null;
}

/** Tutarı TRY'ye çevir. Kur yoksa null (önizleme gösterilmez). */
export function toTRY(
  amount: number,
  currency: string,
  rates: Record<string, FxRateLike>
): number | null {
  const rate = fxRate(currency, rates);
  return rate == null ? null : amount * rate;
}
