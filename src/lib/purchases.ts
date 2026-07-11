// Native IAP soyutlaması (RevenueCat YOK). Gerçek StoreKit / Google Play Billing
// entegrasyonu dev-build sonrası BURAYA bağlanır (Expo Go'da mağaza satın alma çalışmaz).
//
// Gerçek akışta bağlanacak adımlar (react-native-iap veya expo-in-app-purchases):
//   1. product_id map        → PLAN_PRODUCTS[].productId (aşağıda hazır)
//   2. purchase start        → requestSubscription(productId)
//   3. purchase success      → purchaseUpdatedListener
//   4. purchase failure      → purchaseErrorListener
//   5. restore purchases     → getAvailablePurchases()
//   6. subscription status   → getAvailablePurchases() + expiry
//   7. entitlement update    → verifyReceipt() → entitlements tablosu → useEntitlement.refresh()
//   8. receipt/token backend  → Supabase Edge Function (server-side doğrulama, service-role)
//
// Şu an dürüst stub: dev'de yerel plan etkinleştirir; prod'da mağaza yayınına yönlendirir.
import { Alert } from "react-native";
import type { Plan, PlanProduct } from "@/core/plan";
import { PLAN_PRODUCTS } from "@/core/plan";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

/** product_id → plan eşlemesi (store & backend doğrulama için tek kaynak). */
export const PRODUCT_ID_TO_PLAN: Record<string, Plan> = Object.fromEntries(
  PLAN_PRODUCTS.map((p) => [p.productId, p.plan])
);

export interface PurchaseHandlers {
  /** Satın alma "başarılı" olduğunda planı uygula (stub: yerel; gerçek: backend sync sonrası). */
  applyPlan: (plan: Plan) => Promise<void>;
}

/** Seçili tier ürününü satın almayı başlat. */
export async function startPurchase(product: PlanProduct, h: PurchaseHandlers): Promise<void> {
  // TODO(dev-build): react-native-iap.requestSubscription(product.productId) → listener →
  //   verifyReceipt (backend) → h.applyPlan(PRODUCT_ID_TO_PLAN[product.productId]).
  if (isDev) {
    await h.applyPlan(product.plan);
    Alert.alert(
      "Geliştirme modu",
      `“${product.productId}” planı bu cihazda etkinleştirildi. Gerçek mağaza satın alması yayınlanan sürümde açılır.`
    );
    return;
  }
  Alert.alert(
    "Mağaza satın alması",
    "Aile Paketi mağaza üzerinden yayınlanan sürümde açılacak. İlgin için teşekkürler."
  );
}

/** Önceki satın alımları geri yükle. Gerçek: getAvailablePurchases() → verifyReceipt → applyPlan. */
export async function restorePurchases(_h: PurchaseHandlers): Promise<void> {
  if (isDev) {
    Alert.alert("Geliştirme modu", "Geri yükleme yayınlanan sürümde mağaza hesabından çalışır.");
    return;
  }
  Alert.alert("Bilgi", "Aktif abonelik bulunamadı.");
}
