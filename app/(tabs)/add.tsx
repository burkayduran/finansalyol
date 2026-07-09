import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui";
import { colors, spacing } from "@/theme";

// Hızlı işlem merkezi. Kısa, tek satır açıklamalar.
const GROUPS: { title: string; items: { title: string; desc: string; href: string }[] }[] = [
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
      { title: "Varlık ekle", desc: "Nakit, mevduat, altın, döviz, fon veya hisse.", href: "/add-asset" },
      { title: "Gelir ekle", desc: "Maaş, kira geliri veya düzenli gelir.", href: "/add-cashflow?direction=income" },
      { title: "Gider ekle", desc: "Fatura, kira, aidat veya düzenli gider.", href: "/add-cashflow?direction=expense" },
      { title: "Varlıkları gör", desc: "Tüm birikim ve yatırımların.", href: "/assets" },
      { title: "Nakit akışını gör", desc: "Aylık gelir–gider dengen ve projeksiyon.", href: "/cashflow" },
    ],
  },
  {
    title: "Aile",
    items: [
      { title: "Kişi ekle", desc: "Ailene veya hanene yeni kişi ekle.", href: "/family" },
      { title: "Aileyi yönet", desc: "Üyeler, davetler ve kişiler.", href: "/family" },
    ],
  },
];

export default function AddHub() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      {GROUPS.map((g) => (
        <View key={g.title} style={{ marginBottom: spacing(1) }}>
          <Text style={styles.group}>{g.title}</Text>
          {g.items.map((it) => (
            <Pressable key={it.title} onPress={() => router.push(it.href as never)}>
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
