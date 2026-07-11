import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui";
import { useEntitlement } from "@/config/entitlements";
import type { PremiumFeature } from "@/components/PremiumGate";
import { colors, spacing } from "@/theme";

// Hızlı işlem merkezi. premium alanlar entitlement kontrolünden geçer.
type Item = { title: string; desc: string; href: string; feature?: PremiumFeature };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Borç & Ödeme",
    items: [
      { title: "Borç ekle", desc: "Kredi kartı, KMH, taksitli KMH veya kredi.", href: "/add-debt" },
      { title: "Ödeme gir", desc: "Yaklaşan veya mevcut bir borç ödemesini işle.", href: "/pay" },
    ],
  },
  {
    title: "Varlık & Nakit akışı",
    items: [
      { title: "Varlık ekle", desc: "Nakit, mevduat, altın, döviz, fon veya hisse.", href: "/add-asset", feature: "assets" },
      { title: "Gelir ekle", desc: "Maaş, kira geliri veya düzenli gelir.", href: "/add-cashflow?direction=income", feature: "cashflow" },
      { title: "Gider ekle", desc: "Fatura, kira, aidat veya düzenli gider.", href: "/add-cashflow?direction=expense", feature: "cashflow" },
      { title: "Varlıkları gör", desc: "Tüm birikim ve yatırımların.", href: "/assets", feature: "assets" },
      { title: "Nakit akışını gör", desc: "Aylık gelir–gider dengen ve projeksiyon.", href: "/cashflow", feature: "cashflow" },
    ],
  },
  {
    title: "Aile",
    items: [
      { title: "Kişi ekle", desc: "Ailene veya hanene yeni kişi ekle.", href: "/family", feature: "family" },
      { title: "Aileyi yönet", desc: "Üyeler, davetler ve kişiler.", href: "/family", feature: "family" },
    ],
  },
];

export default function AddHub() {
  const router = useRouter();
  const { features } = useEntitlement();

  const allowed = (feature?: PremiumFeature): boolean => {
    if (!feature) return true;
    if (feature === "family") return features.canUseFamily;
    if (feature === "cashflow") return features.canUseCashflow;
    if (feature === "assets") return features.canUseAssets;
    return true;
  };

  const open = (it: Item) => {
    if (!allowed(it.feature)) return router.push(`/paywall?feature=${it.feature}`);
    router.push(it.href as never);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      {GROUPS.map((g) => (
        <View key={g.title} style={{ marginBottom: spacing(1) }}>
          <Text style={styles.group}>{g.title}</Text>
          {g.items.map((it) => (
            <Pressable key={it.title} onPress={() => open(it)}>
              <Card>
                <Text style={styles.itemTitle}>{it.title}</Text>
                <Text style={styles.itemDesc}>{it.desc}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ height: spacing(2) }} />
    </ScrollView>
  );
}

const styles = {
  group: { fontSize: 14, fontWeight: "800" as const, color: colors.muted, marginBottom: spacing(0.5), marginTop: spacing(1) },
  itemTitle: { fontSize: 16, fontWeight: "700" as const, color: colors.ink },
  itemDesc: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
};
