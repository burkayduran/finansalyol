// Native IAP istemci entegrasyonu (react-native-iap; RevenueCat YOK).
// - initConnection / getSubscriptions (mağaza fiyatı) / requestSubscription
// - purchaseUpdated & purchaseError listener / finishTransaction / restore
// - Doğrulama: verify-purchase Edge Function (server-side). İstemci "başarılı" demez.
// - Native modül yoksa (Expo Go/web) güvenli fallback; production'da sahte satın alma YOK.
//   Yalnız __DEV__ + EXPO_PUBLIC_IAP_DEV_OVERRIDE=1 birlikteyken yerel plan etkinleşir.
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as IAP from "react-native-iap";
import { supabase } from "@/lib/supabase";
import { useEntitlement } from "@/config/entitlements";
import { PLAN_PRODUCTS, type Plan } from "@/core/plan";

const SKUS = PLAN_PRODUCTS.map((p) => p.productId);
const DEV_OVERRIDE =
  (typeof __DEV__ !== "undefined" && __DEV__) && process.env.EXPO_PUBLIC_IAP_DEV_OVERRIDE === "1";

export interface StoreProduct {
  productId: string;
  plan: Plan;
  persons: number;
  /** Mağazadan gelen yerelleştirilmiş fiyat; yoksa null (koddaki fiyat fallback gösterilir). */
  localizedPrice: string | null;
}

async function verifyOnBackend(platform: "ios" | "android", productId: string, purchase: any): Promise<boolean> {
  const body =
    platform === "ios"
      ? { platform, productId, receipt: purchase?.transactionReceipt }
      : { platform, productId, token: purchase?.purchaseToken };
  const { data, error } = await supabase.functions.invoke("verify-purchase", { body });
  if (error) return false;
  return !!(data as any)?.ok;
}

export function useIap() {
  const { refresh, setLocalPlan } = useEntitlement();
  const [products, setProducts] = useState<StoreProduct[]>(
    PLAN_PRODUCTS.map((p) => ({ productId: p.productId, plan: p.plan, persons: p.persons, localizedPrice: null }))
  );
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const subs = useRef<{ update?: any; error?: any }>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await IAP.initConnection();
        if (!mounted) return;
        setAvailable(true);

        subs.current.update = IAP.purchaseUpdatedListener(async (purchase: any) => {
          try {
            const platform = Platform.OS === "ios" ? "ios" : "android";
            const ok = await verifyOnBackend(platform, purchase.productId, purchase);
            if (ok) {
              await IAP.finishTransaction({ purchase, isConsumable: false });
              await refresh();
            }
          } catch {
            /* sessiz: kullanıcıya error listener üzerinden bilgi verilir */
          } finally {
            setBusy(false);
          }
        });
        subs.current.error = IAP.purchaseErrorListener((e: any) => {
          setBusy(false);
          if (e?.code === "E_USER_CANCELLED") return; // kullanıcı iptali: sessiz
          Alert.alert("Satın alma", "İşlem tamamlanamadı. Lütfen tekrar dene.");
        });

        const subsList: any[] = await IAP.getSubscriptions({ skus: SKUS });
        if (!mounted) return;
        setProducts(
          PLAN_PRODUCTS.map((p) => {
            const s = subsList.find((x) => x.productId === p.productId);
            return { productId: p.productId, plan: p.plan, persons: p.persons, localizedPrice: s?.localizedPrice ?? null };
          })
        );
      } catch {
        if (mounted) setAvailable(false); // native modül yok (Expo Go) → fallback
      }
    })();
    return () => {
      mounted = false;
      subs.current.update?.remove?.();
      subs.current.error?.remove?.();
      IAP.endConnection().catch(() => {});
    };
  }, [refresh]);

  const buy = useCallback(
    async (productId: string) => {
      if (!available) {
        if (DEV_OVERRIDE) {
          const p = PLAN_PRODUCTS.find((x) => x.productId === productId);
          if (p) { await setLocalPlan(p.plan); Alert.alert("Geliştirme", `${productId} (dev override) etkin.`); }
          return;
        }
        Alert.alert("Mağaza", "Satın alma bu ortamda kullanılamıyor. Lütfen mağaza sürümünü kullan.");
        return;
      }
      try {
        setBusy(true);
        await IAP.requestSubscription({ sku: productId });
        // Sonuç purchaseUpdatedListener'da işlenir.
      } catch {
        setBusy(false);
      }
    },
    [available, setLocalPlan]
  );

  const restore = useCallback(async () => {
    if (!available) {
      Alert.alert("Geri yükleme", DEV_OVERRIDE ? "Dev ortamında geri yükleme yok." : "Mağaza sürümünde kullanılabilir.");
      return;
    }
    try {
      setBusy(true);
      const purchases: any[] = await IAP.getAvailablePurchases();
      let restored = false;
      for (const purchase of purchases) {
        const platform = Platform.OS === "ios" ? "ios" : "android";
        if (await verifyOnBackend(platform, purchase.productId, purchase)) restored = true;
      }
      await refresh();
      Alert.alert("Geri yükleme", restored ? "Aboneliğin geri yüklendi." : "Aktif abonelik bulunamadı.");
    } catch {
      Alert.alert("Geri yükleme", "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }, [available, refresh]);

  return { products, available, busy, buy, restore };
}
