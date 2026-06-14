// Son ödeme günü -> kalan gün hesabı.

/** Bir sonraki `dueDay` (ayın günü, 1–31) tarihine kalan gün sayısı. */
export function daysUntilDue(dueDay: number, today: Date = new Date()): number {
  const y = today.getFullYear();
  const m = today.getMonth();
  const clamp = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Math.min(dueDay, lastDay);
  };

  let target = new Date(y, m, clamp(y, m));
  const todayMidnight = new Date(y, m, today.getDate());
  if (target < todayMidnight) {
    const nm = m + 1;
    target = new Date(y, nm, clamp(y, nm));
  }
  const diff = target.getTime() - todayMidnight.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
