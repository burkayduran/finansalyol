// Abonelik durumu → erişim kararı (saf; SQL current_plan ile birebir kural).
// Edge Function (Deno) aynı kuralı kendi içinde tekrar eder (runtime izolasyonu).
import type { Plan } from "./plan";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "grace_period"
  | "billing_retry"
  | "expired"
  | "cancelled"
  | "refunded"
  | "revoked";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trial", "grace_period", "billing_retry"];

export interface EntitlementLike {
  plan: Plan;
  subscription_status: SubscriptionStatus | string;
  premium_until: string | null;
}

/** Doğrulanmış expiry'ye göre erişim var mı? cancelled → yalnız süre dolmadıysa; expired/refunded/revoked → asla. */
export function subscriptionGrantsAccess(
  status: string,
  premiumUntilISO: string | null | undefined,
  now: Date = new Date()
): boolean {
  const notExpired = !premiumUntilISO || new Date(premiumUntilISO) >= now;
  if (ACTIVE_STATUSES.includes(status as SubscriptionStatus)) return notExpired;
  if (status === "cancelled") return !!premiumUntilISO && new Date(premiumUntilISO) >= now;
  return false; // expired / refunded / revoked / bilinmeyen
}

/** Entitlement kaydından etkin planı çöz (erişim yoksa "free"). */
export function planFromEntitlement(e: EntitlementLike | null | undefined, now: Date = new Date()): Plan {
  if (!e) return "free";
  return subscriptionGrantsAccess(e.subscription_status, e.premium_until, now) ? e.plan : "free";
}
