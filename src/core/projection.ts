// Taksitli borç (kredi & taksitli KMH) için ay-ay projeksiyon.
// Gelecek aylarda ödenecek toplam yükümlülük + kalan toplam bakiye.

export interface InstallmentDebt {
  id: string;
  label: string;
  installment: number;
  termCount: number;
  firstInstallmentDate: Date;
  balance: number;
}

export interface ProjectionMonth {
  month: Date;
  totalDue: number;
  remainingTotal: number;
  perDebt: { id: string; due: number; remaining: number }[];
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * `from`'dan başlayarak `months` ay için ay-ay projeksiyon.
 * Bir borç, taksiti o aya denk geliyorsa (ilk taksit ayı ile ilk taksit ayı +
 * termCount-1 arası) o ay `installment` kadar yükümlülük getirir.
 * Kalan = max(0, balance − installment × o aya kadar yapılan taksit sayısı).
 */
export function projectMonths(
  debts: InstallmentDebt[],
  months = 12,
  from: Date = new Date()
): ProjectionMonth[] {
  const fromIdx = monthIndex(from);
  const result: ProjectionMonth[] = [];

  for (let k = 0; k < months; k++) {
    const idx = fromIdx + k;
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    const monthDate = new Date(year, month, 1);

    let totalDue = 0;
    let remainingTotal = 0;
    const perDebt: ProjectionMonth["perDebt"] = [];

    for (const d of debts) {
      const firstIdx = monthIndex(d.firstInstallmentDate);
      const lastIdx = firstIdx + d.termCount - 1;
      const due = idx >= firstIdx && idx <= lastIdx ? d.installment : 0;
      const paidCount = Math.max(0, Math.min(d.termCount, idx - firstIdx + 1));
      const remaining = Math.max(0, d.balance - d.installment * paidCount);

      totalDue += due;
      remainingTotal += remaining;
      perDebt.push({ id: d.id, due, remaining });
    }

    result.push({ month: monthDate, totalDue, remainingTotal, perDebt });
  }

  return result;
}
