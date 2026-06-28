// Aylık gelir-gider projeksiyonu. net = gelir − (gider + o ayın borç yükümlülüğü).
// Gelir/gider kalemleri aylık tekrar eden VEYA tek seferlik olabilir.

export interface CashflowEntry {
  amount: number;
  direction: "income" | "expense";
  recurrence: "monthly" | "one_time";
  /** one_time için: hangi ayda sayılacağı. */
  occurredOn?: Date;
}

export interface CashflowDebt {
  kind: "credit_card" | "kmh" | "installment_kmh" | "loan";
  /** Kart/KMH için her ay tekrar eden zorunlu (asgari) tutar. */
  monthlyMinimum?: number;
  /** Taksitli borçlar için program. */
  installment?: number;
  termCount?: number;
  firstInstallmentDate?: Date;
}

export interface MonthlyFlow {
  month: Date;
  income: number;
  expense: number;
  debtDue: number;
  net: number;
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Bir borcun belirli ay-indeksindeki yükümlülüğü. */
function debtDueAt(debt: CashflowDebt, idx: number): number {
  if (
    (debt.kind === "loan" || debt.kind === "installment_kmh") &&
    debt.installment != null &&
    debt.termCount != null &&
    debt.firstInstallmentDate != null
  ) {
    const firstIdx = monthIndex(debt.firstInstallmentDate);
    const lastIdx = firstIdx + debt.termCount - 1;
    return idx >= firstIdx && idx <= lastIdx ? debt.installment : 0;
  }
  // Kart/KMH: her ay tekrar eden asgari (varsa).
  return debt.monthlyMinimum ?? 0;
}

/** Bir kalemin belirli ay-indeksindeki katkısı (monthly her ay, one_time yalnız kendi ayı). */
function entryAt(entry: CashflowEntry, idx: number): number {
  if (entry.recurrence === "monthly") return entry.amount;
  if (entry.occurredOn && monthIndex(entry.occurredOn) === idx) return entry.amount;
  return 0;
}

/**
 * `from`'dan başlayarak `months` ay için gelir-gider projeksiyonu.
 * Tutarlar TRY varsayımıyla gelir (FX dönüşümü çağırandan).
 */
export function projectCashflow(
  entries: CashflowEntry[],
  debts: CashflowDebt[],
  months = 12,
  from: Date = new Date()
): MonthlyFlow[] {
  const fromIdx = monthIndex(from);
  const result: MonthlyFlow[] = [];

  for (let k = 0; k < months; k++) {
    const idx = fromIdx + k;
    const monthDate = new Date(Math.floor(idx / 12), idx % 12, 1);

    let income = 0;
    let expense = 0;
    for (const e of entries) {
      const v = entryAt(e, idx);
      if (e.direction === "income") income += v;
      else expense += v;
    }
    const debtDue = debts.reduce((s, d) => s + debtDueAt(d, idx), 0);

    result.push({ month: monthDate, income, expense, debtDue, net: income - expense - debtDue });
  }
  return result;
}
