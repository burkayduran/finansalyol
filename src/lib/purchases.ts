// Native IAP soyutlaması (RevenueCat YOK). Gerçek StoreKit / Google Play Billing
// entegrasyonu dev-build sonrası BURAYA bağlanır. Expo Go'da mağaza satın alma
// çalışmaz; bu yüzden şimdilik dürüst bir stub: dev'de yerel plan etkinleştirir,
// prod'da kullanıcıyı bilgilendirir. Akış: seç → satın al → backend entitlement → erişim.
import { Alert } from "react-native";
import type { Plan, PlanProduct } from "@/core/plan";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

export interface PurchaseHandlers {
  /** Satın alma "başarılı" olduğunda planı uygula (stub: yerel; gerçek: backend sync). */
  applyPlan: (plan: Plan) => Promise<void>;
}

/** Bir tier ürünü satın almayı başlat. */
export async function startPurchase(product: PlanProduct, h: PurchaseHandlers): Promise<void> {
  if (isDev) {
    await h.applyPlan(product.plan);
    Alert.alert(
      "Geliştirme modu",
      `“${product.productId}” planı bu cihazda etkinleştirildi. Gerçek mağaza satın alması yayınlanan sürümde çalışır.`
    );
    return;
  }
  Alert.alert(
    "Satın alma yakında",
    "Aile Paketi mağaza üzerinden yayınlanan sürümde açılacak. İlgin için teşekkürler."
  );
}

/** Önceki satın alımları geri yükle. Gerçek akış: makbuz doğrula → backend entitlement → applyPlan. */
export async function restorePurchases(_h: PurchaseHandlers): Promise<void> {
  if (isDev) {
    Alert.alert("Geliştirme modu", "Geri yükleme yayınlanan sürümde mağaza hesabından çalışır.");
    return;
  }
  Alert.alert("Bilgi", "Aktif abonelik bulunamadı.");
}
