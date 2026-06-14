// Event tracking (§9, §10). real_* vs sample_* AYRI tutulur.
// 0A'da backend yok — event'ler local buffer'a yazılır, console'a düşer.
// Funnel ve north-star YALNIZ real_* event'lerden okunur.

export type EventName =
  // Ekran 1
  | "screen1_viewed"
  | "cta_real_clicked"
  | "cta_sample_clicked"
  // Ekran 2 (gerçek)
  | "real_debt_started"
  | "real_debt_completed"
  | "field_dropoff"
  // Ekran 3 (gerçek)
  | "real_first_insight_viewed"
  | "reminder_set"
  | "extra_default_shown"
  // Ekran 4
  | "second_debt_added"
  | "proceed_to_plan"
  // Ekran 5
  | "real_plan_viewed"
  | "strategy_toggled"
  | "payment_logged"
  // Sample yolu
  | "sample_session_started"
  | "sample_first_insight_viewed"
  | "sample_plan_viewed";

export interface TrackedEvent {
  name: EventName;
  props?: Record<string, unknown>;
  ts: string;
}

const BUFFER_KEY = "borc-takip-0a:events:v1";
const buffer: TrackedEvent[] = [];

export function track(name: EventName, props?: Record<string, unknown>): void {
  const event: TrackedEvent = { name, props, ts: new Date().toISOString() };
  buffer.push(event);
  try {
    const existing = JSON.parse(localStorage.getItem(BUFFER_KEY) ?? "[]");
    existing.push(event);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(existing.slice(-500)));
  } catch {
    /* best effort */
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[event]", name, props ?? "");
  }
}

export function getEvents(): TrackedEvent[] {
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) ?? "[]");
  } catch {
    return [...buffer];
  }
}
