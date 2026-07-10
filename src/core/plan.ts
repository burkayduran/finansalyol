// Gelir modeli — saf plan/özellik mantığı (framework-bağımsız, test edilebilir).
// Free = tek kişi + borç/takvim/push/temel içgörü. Premium (Aile Paketi) = aile/nakit
// akışı/varlık/mail/gelişmiş içgörü. RevenueCat YOK; native IAP dev-build sonrası bağlanır.

export type Plan = "free" | "family_4" | "family_5" | "family_6" | "family_7";

/** Plana göre eklenebilir kişi sınırı. */
export const PLAN_PERSON_LIMIT: Record<Plan, number> = {
  free: 1,
  family_4: 4,
  family_5: 5,
  family_6: 6,
  family_7: 7,
};

export interface PlanFeatures {
  canUseFamily: boolean;
  canUseCashflow: boolean;
  canUseAssets: boolean;
  canUseEmailReminder: boolean;
  personLimit: number;
}

export function isPremium(plan: Plan): boolean {
  return plan !== "free";
}

export function planFeatures(plan: Plan): PlanFeatures {
  const premium = isPremium(plan);
  return {
    canUseFamily: premium,
    canUseCashflow: premium,
    canUseAssets: premium,
    canUseEmailReminder: premium,
    personLimit: PLAN_PERSON_LIMIT[plan],
  };
}

// --- Fiyatlar (TL / ay) ---
export const FAMILY_BASE_PRICE = 159.99; // 4 kişi dahil
export const EXTRA_PERSON_PRICE = 39.99; // 4 üstü kişi başına

export interface PlanProduct {
  productId: string;
  plan: Plan;
  persons: number;
  monthlyPrice: number;
}

/** Store tier ürünleri (dinamik ek kişi yerine sabit tier'lar — daha temiz). */
export const PLAN_PRODUCTS: PlanProduct[] = [
  { productId: "family_4_monthly", plan: "family_4", persons: 4, monthlyPrice: 159.99 },
  { productId: "family_5_monthly", plan: "family_5", persons: 5, monthlyPrice: 199.99 },
  { productId: "family_6_monthly", plan: "family_6", persons: 6, monthlyPrice: 239.99 },
  { productId: "family_7_monthly", plan: "family_7", persons: 7, monthlyPrice: 279.99 },
];

/** Verilen kişi sayısını karşılayan en küçük tier ürün. */
export function productForPersonCount(persons: number): PlanProduct {
  return (
    PLAN_PRODUCTS.find((p) => p.persons >= persons) ?? PLAN_PRODUCTS[PLAN_PRODUCTS.length - 1]
  );
}

// --- Danışmanlık ürünü (native IAP DIŞI; birebir hizmet) ---
export const CONSULT_PRODUCT_NAME = "Borç Azaltma Planı";
export const CONSULT_PRICE = 1999;
export const CONSULT_LAUNCH_PRICE = 1699;
