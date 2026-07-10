import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { PREMIUM_COPY, type PremiumFeature } from "@/components/PremiumGate";
import { useEntitlement } from "@/config/entitlements";
import { startPurchase, restorePurchases } from "@/lib/purchases";
import {
  EXTRA_PERSON_PRICE,
  FAMILY_BASE_PRICE,
  PLAN_PRODUCTS,
  productForPersonCount,
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

export default function Paywall() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { setLocalPlan, isPremium, plan } = useEntitlement();

  const featureCopy = feature && feature in PREMIUM_COPY ? PREMIUM_COPY[feature as PremiumFeature] : null;
  const baseProduct = productForPersonCount(4); // family_4 taban

  const applyPlan = async (p: typeof baseProduct.plan) => {
    await setLocalPlan(p);
  };

  const buy = async () => {
    await startPurchase(baseProduct, { applyPlan });
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

      <Card>
        <Text style={[typography.label, { color: colors.inkSoft, marginBottom: 6 }]}>Paketler</Text>
        {PLAN_PRODUCTS.map((p) => (
          <View key={p.productId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ color: colors.ink }}>{p.persons} kişi</Text>
            <Text style={{ color: colors.inkSoft, fontWeight: "700" }}>₺{money(p.monthlyPrice)} / ay</Text>
          </View>
        ))}
      </Card>

      {isPremium ? (
        <Card>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Aile Paketi aktif ✓</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 4 }}>Mevcut plan: {plan}</Text>
        </Card>
      ) : (
        <Button title="Aile Paketi’ni başlat" onPress={buy} />
      )}
      <Button title="Satın alımı geri yükle" variant="ghost" onPress={restore} />
      <Button title="Kapat" variant="link" onPress={() => router.back()} />
    </ScrollView>
  );
}
