// "Borç Azaltma Planı" danışmanlık CTA — ana sayfa ve nakit akışı sayfasında ortak.
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui";
import { CONSULT_PRICE, CONSULT_LAUNCH_PRICE } from "@/core/plan";
import { colors, spacing, typography } from "@/theme";

export function ConsultCTA() {
  const router = useRouter();
  return (
    <Card>
      <Text style={typography.cardTitle}>Borçlarını daha rahat ödemek için plan çıkaralım mı?</Text>
      <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>
        Gelir, gider, borç ve ödeme takvimine göre sana özel borç azaltma planı hazırlayalım.
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: spacing(1) }}>
        <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 18 }}>Lansmana özel ₺{CONSULT_LAUNCH_PRICE}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: "line-through" }}>₺{CONSULT_PRICE}</Text>
      </View>
      <Pressable onPress={() => router.push("/consult")} style={styles.cta}>
        <Text style={{ color: colors.primaryInk, fontWeight: "700" }}>Plan görüşmesi al</Text>
      </Pressable>
    </Card>
  );
}

const styles = {
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center" as const,
    marginTop: spacing(1.5),
  },
};
