// Son ödeme günü -> kalan gün hesabı. Hatırlatma motoru da bunu kullanır.

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

/** Bir sonraki son ödeme tarihini (Date) döner. */
export function nextDueDate(dueDay: number, today: Date = new Date()): Date {
  const days = daysUntilDue(dueDay, today);
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const TR_MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

/** "Salı, 19 Haz" gibi kısa tr gösterim. */
export function formatShortDate(date: Date): string {
  return `${TR_DAYS[date.getDay()]}, ${date.getDate()} ${TR_MONTHS[date.getMonth()]}`;
}
