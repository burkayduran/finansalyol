import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { PREMIUM_COPY, type PremiumFeature } from "@/components/PremiumGate";
import { useEntitlement } from "@/config/entitlements";
import { startPurchase, restorePurchases } from "@/lib/purchases";
import {
  EXTRA_PERSON_PRICE,
  FAMILY_BASE_PRICE,
  PLAN_PRODUCTS,
  type Plan,
  type PlanProduct,
} from "@/core/plan";
import { colors, spacing, typography } from "@/theme";

const BENEFITS = [
  "Aile / hane takibi",
  "Nakit akışı",
  "Varlık takibi",
  "Mail ile ödeme uyarısı",
  "Gelişmiş içgörü",
];

const money = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
// Varsayılan seçim ETİK olarak 4 kişilik paket (kullanıcıdan habersiz üst paket seçili gelmez).
const DEFAULT_PRODUCT = PLAN_PRODUCTS[0];

export default function Paywall() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { setLocalPlan, isPremium, plan } = useEntitlement();
  const [selected, setSelected] = useState<PlanProduct>(DEFAULT_PRODUCT);

  const featureCopy = feature && feature in PREMIUM_COPY ? PREMIUM_COPY[feature as PremiumFeature] : null;

  const applyPlan = async (p: Plan) => {
    await setLocalPlan(p);
  };
  const buy = async () => {
    await startPurchase(selected, { applyPlan });
  };
  const restore = async () => {
    await restorePurchases({ applyPlan });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(3) }}>
      {featureCopy && (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink }]}>{featureCopy.title}</Text>
          <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>{featureCopy.body}</Text>
        </Card>
      )}

      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}>Aile Paketi</Text>
      <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 20, marginTop: spacing(1) }}>
        ₺{money(FAMILY_BASE_PRICE)} / ay
      </Text>
      <Text style={{ color: colors.inkSoft, marginBottom: spacing(2) }}>4 kişi dahil</Text>

      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink, marginBottom: spacing(1) }]}>Neler dahil?</Text>
        {BENEFITS.map((b) => (
          <View key={b} style={{ flexDirection: "row", gap: 8, paddingVertical: spacing(0.5) }}>
            <Text style={{ color: colors.asset, fontWeight: "800" }}>✓</Text>
            <Text style={{ color: colors.ink, flex: 1 }}>{b}</Text>
          </View>
        ))}
        <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: spacing(1) }}>
          4 kişi üzeri için ek kişi başı ₺{money(EXTRA_PERSON_PRICE)} / ay.
        </Text>
      </Card>

      <Text style={[typography.label, { color: colors.inkSoft, marginBottom: 6 }]}>Paketini seç</Text>
      {PLAN_PRODUCTS.map((p) => {
        const active = selected.productId === p.productId;
        return (
          <Pressable key={p.productId} onPress={() => setSelected(p)} style={[styles.pkg, active && styles.pkgActive]}>
            <View style={styles.radioWrap}>
              <View style={[styles.radio, active && styles.radioOn]} />
              <View>
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  {p.persons} kişi{p.plan === "family_5" ? "  · Esnek seçim" : ""}
                </Text>
                <Text style={{ color: colors.inkSoft, fontSize: 13 }}>₺{money(p.monthlyPrice)} / ay</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {isPremium ? (
        <Card>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Aile Paketi aktif ✓</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 4 }}>Mevcut plan: {plan}</Text>
        </Card>
      ) : (
        <Button title={`${selected.persons} kişilik paketi başlat — ₺${money(selected.monthlyPrice)}/ay`} onPress={buy} />
      )}
      <Button title="Satın alımı geri yükle" variant="ghost" onPress={restore} />
      <Button title="Kapat" variant="link" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = {
  pkg: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: spacing(1.5),
    marginBottom: spacing(1),
    backgroundColor: colors.surface,
  },
  pkgActive: { borderColor: colors.accent, backgroundColor: colors.primarySoft },
  radioWrap: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.muted },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
};
