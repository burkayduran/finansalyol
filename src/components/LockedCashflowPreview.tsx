// Free kullanıcı için nakit akışı teaser'ı: gerçek data YOK, kilitli/örnek demo kart.
// expo-blur eklemeden yarı opak overlay fallback'i (iOS/Android/Web'de tutarlı).
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui";
import { FAMILY_BASE_PRICE } from "@/core/plan";
import { colors, spacing, typography } from "@/theme";

const DEMO_BARS = [42, 68, 30, 84, 54, 72]; // örnek yükseklikler (gerçek veri değil)
const price = FAMILY_BASE_PRICE.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

export function LockedCashflowPreview() {
  const router = useRouter();
  const openInfo = () => {
    Alert.alert(
      "Nakit akışı Aile Paketi’ne özel",
      `Gelir, gider ve borç ödemelerini aylık bazda birlikte takip etmek için Aile Paketi’ne geçebilirsin.\n\n₺${price} / ay · 4 kişi dahil`,
      [
        { text: "Kapat", style: "cancel" },
        { text: "Aile Paketi’ni gör", onPress: () => router.push("/paywall?feature=cashflow") },
      ]
    );
  };

  return (
    <Pressable onPress={openInfo}>
      <Card>
        <Text style={typography.cardTitle}>Nakit akışı · planlanan</Text>
        <View style={{ marginTop: spacing(1) }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 96, gap: 10 }}>
            {DEMO_BARS.map((h, i) => (
              <View key={i} style={{ flex: 1, height: `${h}%`, backgroundColor: colors.primarySoft, borderRadius: 4 }} />
            ))}
          </View>
          <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <Text style={{ color: colors.ink, fontWeight: "800" }}>🔒 Aile Paketi’ne özel</Text>
            <Text style={{ color: colors.accent, fontWeight: "700", marginTop: 4 }}>Aile Paketi’ni gör →</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    // Fallback yarı opak katman (spec §2): rgba(243,244,246,0.78)
    backgroundColor: "rgba(243,244,246,0.78)",
  },
});
