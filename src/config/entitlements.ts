// Ücret sınırları — yalnız iskelet. Native IAP bağımlılığı YOK (Expo Go bozulmaz).
// useEntitlement şimdilik "premium" döner: mevcut kullanıcı deneyimi DEĞİŞMEZ.
// Gate kodu hazır; kapı açık. Gerçek entitlement (RevenueCat) EAS build hattından sonra bağlanır.

export const FREE_LIMITS = {
  maxPersons: 2,
  allowInvites: false,
  emailDigest: false,
};

export type Entitlement = "free" | "premium";

/** Aktif entitlement. Şimdilik sabit "premium" — gate'leri açmak için "free" yap. */
export function useEntitlement(): Entitlement {
  return "premium";
}

export const PREMIUM_BENEFITS = [
  "Aile davetiyle çoklu kullanıcı",
  "Sınırsız kişi",
  "E-posta haftalık özet",
  "İleride: otomatik fiyat güncellemeleri",
];
