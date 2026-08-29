// Satın alma doğrulama — adapter arayüzleri + saf çözümleyiciler (test edilebilir).
// verify-purchase Edge Function bu sözleşmeyi kendi Deno kopyasıyla uygular.
import { PLAN_PRODUCTS, type Plan } from "./plan";
import type { SubscriptionStatus } from "./subscription";

export type StorePlatform = "ios" | "android";

export interface VerifyRequest {
  platform: StorePlatform;
  productId: string;
  receipt?: string; // iOS
  token?: string; // Android purchase token
}

export interface VerifiedSubscription {
  platform: StorePlatform;
  productId: string;
  plan: Plan;
  originalTransactionId: string;
  latestTransactionId: string;
  status: SubscriptionStatus;
  premiumUntil: string | null; // ISO
  environment: "sandbox" | "production";
}

export interface StoreAdapter {
  verify(req: VerifyRequest): Promise<VerifiedSubscription>;
}

/** Gerçek credential yoksa adapter bunu fırlatır; server sahte başarı ÜRETMEZ. */
export class NotConfiguredError extends Error {
  code = "NOT_CONFIGURED" as const;
  constructor(msg = "Store doğrulama yapılandırılmadı") {
    super(msg);
    this.name = "NotConfiguredError";
  }
}

export const SUPPORTED_PRODUCT_IDS: string[] = PLAN_PRODUCTS.map((p) => p.productId);

export function isSupportedProduct(productId: string): boolean {
  return SUPPORTED_PRODUCT_IDS.includes(productId);
}

export function productIdToPlan(productId: string): Plan | null {
  return PLAN_PRODUCTS.find((p) => p.productId === productId)?.plan ?? null;
}

/** İstenen platformun adapter'ını seç; yoksa NOT_CONFIGURED. */
export function selectAdapter(
  platform: StorePlatform,
  adapters: Partial<Record<StorePlatform, StoreAdapter>>
): StoreAdapter {
  const a = adapters[platform];
  if (!a) throw new NotConfiguredError(`${platform} doğrulama sağlayıcısı yapılandırılmadı`);
  return a;
}

export interface EntitlementUpsert {
  user_id: string;
  plan: Plan;
  platform: StorePlatform;
  product_id: string;
  subscription_status: SubscriptionStatus;
  premium_until: string | null;
  original_transaction_id: string;
  latest_transaction_id: string;
  environment: "sandbox" | "production";
  person_limit: number;
  last_receipt_check_at: string;
  updated_at: string;
}

const PLAN_LIMIT: Record<Plan, number> = {
  free: 1, family_4: 4, family_5: 5, family_6: 6, family_7: 7,
};

/** Doğrulanmış sonucu entitlements satırına çevir (idempotent upsert için). */
export function toEntitlementUpsert(userId: string, v: VerifiedSubscription, nowISO: string): EntitlementUpsert {
  return {
    user_id: userId,
    plan: v.plan,
    platform: v.platform,
    product_id: v.productId,
    subscription_status: v.status,
    premium_until: v.premiumUntil,
    original_transaction_id: v.originalTransactionId,
    latest_transaction_id: v.latestTransactionId,
    environment: v.environment,
    person_limit: PLAN_LIMIT[v.plan],
    last_receipt_check_at: nowISO,
    updated_at: nowISO,
  };
}
