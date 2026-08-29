// Hatırlatma uygunluk kuralları (saf; reminder-cron aynısını Deno'da uygular).
export type ReminderTag = "7d" | "3d" | "1d" | "due" | "overdue";

export interface ReminderPrefLike {
  push_enabled: boolean;
  email_enabled: boolean;
  remind_7d: boolean;
  remind_3d: boolean;
  remind_1d: boolean;
  remind_due_day: boolean;
  remind_overdue: boolean;
  hide_amount_in_notifications: boolean;
}

/** Gün offset'ine karşılık hatırlatma etiketi (yoksa null). */
export function windowTag(days: number): ReminderTag | null {
  if (days === 7) return "7d";
  if (days === 3) return "3d";
  if (days === 1) return "1d";
  if (days === 0) return "due";
  if (days === -1) return "overdue";
  return null;
}

/** Bu gün offset'i için ilgili tercih açık mı? */
export function windowOpen(pref: ReminderPrefLike, days: number): boolean {
  const tag = windowTag(days);
  if (!tag) return false;
  if (tag === "7d") return pref.remind_7d;
  if (tag === "3d") return pref.remind_3d;
  if (tag === "1d") return pref.remind_1d;
  if (tag === "due") return pref.remind_due_day;
  return pref.remind_overdue;
}

export interface EmailEligibilityInput {
  pref: ReminderPrefLike;
  hasPremium: boolean;
  email: string | null | undefined;
  emailVerified: boolean;
  occurrenceOpen: boolean; // pending/partial/overdue
  windowOpen: boolean;
}

/** E-posta gönderilebilir mi? (tüm koşullar birlikte) */
export function emailEligible(i: EmailEligibilityInput): boolean {
  return (
    i.pref.email_enabled &&
    i.hasPremium &&
    !!i.email &&
    i.emailVerified &&
    i.occurrenceOpen &&
    i.windowOpen
  );
}

/** Bildirim gövdesi; mahremiyet tercihi açıksa tutar yazılmaz. */
export function reminderBody(name: string, days: number, remainingText: string, hideAmount: boolean): string {
  const when = days < 0 ? "dün son gündü" : days === 0 ? "bugün" : `${days} gün kaldı`;
  return hideAmount ? `${name} — ${when}.` : `${name} — ${when}. Tutar: ${remainingText}.`;
}
