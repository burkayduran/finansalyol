// Analytics abstraction. Key varsa PostHog (EU host — KVKK), yoksa dev console.
// KİMLİK/TUTAR asla property olarak gönderilmez; yalnız kategori/tür/owner_type gibi
// nötr alanlar. identify yalnız Supabase user_id ile.
import PostHog from "posthog-react-native";

export type AnalyticsEvent =
  | "account_created"
  | "household_created"
  | "onboarding_completed"
  | "person_added"
  | "debt_added"
  | "asset_added"
  | "cashflow_item_added"
  | "payment_recorded"
  | "payment_reversed"
  | "notification_enabled"
  | "calendar_opened"
  | "pay_screen_opened"
  | "debt_detail_opened"
  | "asset_detail_opened"
  | "person_detail_opened"
  | "export_data_clicked"
  | "invite_sent"
  | "delete_request_created";

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const isDev = typeof __DEV__ !== "undefined" && __DEV__;

let client: PostHog | null = null;
if (KEY) {
  try {
    client = new PostHog(KEY, { host: HOST });
  } catch {
    client = null;
  }
}

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, properties ?? {});
  }
  client?.capture(event, properties);
}

/** Oturum açılınca yalnız user_id ile kimliklendir (PII yok). */
export function identify(userId: string): void {
  client?.identify(userId);
}
