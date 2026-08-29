// Entitlement (plan) sağlayıcı. Plan çözümü: yerel override (test / IAP-öncesi stub)
// → backend `entitlements` (aktif abonelik) → "free". RevenueCat YOK; gerçek native
// Native IAP (StoreKit / Play Billing) `src/lib/iap.ts` (react-native-iap) ile bağlanır;
// doğrulama server-side `verify-purchase` Edge Function'da yapılır.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { planFeatures, type Plan, type PlanFeatures } from "@/core/plan";

const LOCAL_PLAN_KEY = "fy_local_plan"; // yerel override (test + IAP-öncesi stub)

export interface EntitlementValue {
  plan: Plan;
  features: PlanFeatures;
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Yerel plan ayarı — stub satın alma / geliştirme testi (gerçek IAP bunu değiştirir). */
  setLocalPlan: (p: Plan | null) => Promise<void>;
}

const Ctx = createContext<EntitlementValue | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const local = await AsyncStorage.getItem(LOCAL_PLAN_KEY);
      if (local) {
        setPlan(local as Plan);
        return;
      }
      const uid = session?.user.id;
      if (!uid) {
        setPlan("free");
        return;
      }
      const { data } = await supabase
        .from("entitlements")
        .select("plan, subscription_status, premium_until")
        .eq("user_id", uid)
        .maybeSingle();
      const active =
        !!data &&
        data.subscription_status === "active" &&
        (!data.premium_until || data.premium_until >= new Date().toISOString());
      setPlan(active ? (data!.plan as Plan) : "free");
    } catch {
      setPlan("free");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const setLocalPlan = useCallback(
    async (p: Plan | null) => {
      if (p == null) await AsyncStorage.removeItem(LOCAL_PLAN_KEY);
      else await AsyncStorage.setItem(LOCAL_PLAN_KEY, p);
      await load();
    },
    [load]
  );

  const value = useMemo<EntitlementValue>(
    () => ({
      plan,
      features: planFeatures(plan),
      isPremium: plan !== "free",
      loading,
      refresh: load,
      setLocalPlan,
    }),
    [plan, loading, load, setLocalPlan]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement(): EntitlementValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEntitlement must be used within EntitlementProvider");
  return ctx;
}
