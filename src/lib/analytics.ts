// Hafif analytics abstraction. Production provider sonraki fazda bağlanır.
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
  | "debt_detail_opened"
  | "asset_detail_opened"
  | "person_detail_opened"
  | "export_data_clicked"
  | "invite_sent"
  | "delete_request_created";

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log("[analytics]", event, properties ?? {});
  }
  // Production provider (PostHog/Amplitude vb.) burada bağlanır.
}
