// Aylık gelir-gider projeksiyonu. net = gelir − (düzenli gider + o ayın borç yükümlülüğü).

export interface CashflowDebt {
  kind: "credit_card" | "kmh" | "kmh_installment" | "loan";
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
  recurringExpense: number;
  debtDue: number;
  net: number;
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Bir borcun belirli ay-indeksindeki yükümlülüğü. */
function debtDueAt(debt: CashflowDebt, idx: number): number {
  if (
    (debt.kind === "loan" || debt.kind === "kmh_installment") &&
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

/**
 * `from`'dan başlayarak `months` ay için gelir-gider projeksiyonu.
 * incomes/expenses: aylık tekrar eden tutar listeleri (currency=TRY varsayımı; FX
 * dönüşümü çağırandan gelir).
 */
export function projectCashflow(
  incomes: number[],
  expenses: number[],
  debts: CashflowDebt[],
  months = 12,
  from: Date = new Date()
): MonthlyFlow[] {
  const income = incomes.reduce((s, x) => s + x, 0);
  const recurringExpense = expenses.reduce((s, x) => s + x, 0);
  const fromIdx = monthIndex(from);
  const result: MonthlyFlow[] = [];

  for (let k = 0; k < months; k++) {
    const idx = fromIdx + k;
    const monthDate = new Date(Math.floor(idx / 12), idx % 12, 1);
    const debtDue = debts.reduce((s, d) => s + debtDueAt(d, idx), 0);
    result.push({
      month: monthDate,
      income,
      recurringExpense,
      debtDue,
      net: income - recurringExpense - debtDue,
    });
  }
  return result;
}
