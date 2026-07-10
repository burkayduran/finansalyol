// Premium özellik kilidi kartı. Ekran gizlenmez; aksiyon denenince bu kart/paywall gösterilir.
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { Text } from "react-native";
import { FAMILY_BASE_PRICE } from "@/core/plan";
import { colors, spacing, typography } from "@/theme";

export type PremiumFeature = "family" | "cashflow" | "assets" | "email" | "generic";

export const PREMIUM_COPY: Record<PremiumFeature, { title: string; body: string }> = {
  family: {
    title: "Aile takibi Aile Paketi’ne özel.",
    body: "Eşin, ailen veya hanendeki kişiler için borç, varlık ve ödeme takibini birlikte yönetebilirsin.",
  },
  cashflow: {
    title: "Nakit akışı Aile Paketi’ne özel.",
    body: "Gelir, gider ve borç ödemelerini aylık bazda birlikte takip edebilirsin.",
  },
  assets: {
    title: "Varlık takibi Aile Paketi’ne özel.",
    body: "Birikim, fon, hisse, döviz ve diğer varlıklarını borçlarınla birlikte görebilirsin.",
  },
  email: {
    title: "Mail ile ödeme uyarısı Aile Paketi’ne özel.",
    body: "Push bildirime ek olarak e-posta ile de ödeme hatırlatması alabilirsin.",
  },
  generic: {
    title: "Bu özellik Aile Paketi’ne özel.",
    body: "Aile, nakit akışı, varlık takibi ve mail uyarılarını açmak için Aile Paketi’ne geçebilirsin.",
  },
};

const priceText = FAMILY_BASE_PRICE.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

export function PremiumGate({ feature = "generic" }: { feature?: PremiumFeature }) {
  const router = useRouter();
  const copy = PREMIUM_COPY[feature];
  return (
    <Card>
      <Text style={[typography.cardTitle, { color: colors.ink }]}>{copy.title}</Text>
      <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>{copy.body}</Text>
      <View style={{ marginTop: spacing(1.5), marginBottom: spacing(1) }}>
        <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 18 }}>₺{priceText} / ay</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13 }}>4 kişi dahil</Text>
      </View>
      <Button title="Aile Paketi’ni başlat" onPress={() => router.push("/paywall")} />
    </Card>
  );
}
