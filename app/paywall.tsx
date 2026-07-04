import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { PREMIUM_BENEFITS } from "@/config/entitlements";
import { colors, spacing } from "@/theme";

export default function Paywall() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(3) }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}>{BRAND.appName} Premium</Text>
      <Text style={{ color: colors.inkSoft, marginTop: spacing(1), marginBottom: spacing(2) }}>
        Aile paketiyle tüm haneni tek panoda yönet.
      </Text>
      <Card>
        {PREMIUM_BENEFITS.map((b) => (
          <View key={b} style={{ flexDirection: "row", gap: 8, paddingVertical: spacing(0.75) }}>
            <Text style={{ color: colors.asset, fontWeight: "800" }}>✓</Text>
            <Text style={{ color: colors.ink, flex: 1 }}>{b}</Text>
          </View>
        ))}
      </Card>
      <Button title="Yakında" onPress={() => router.back()} />
      <Button title="Kapat" variant="link" onPress={() => router.back()} />
    </ScrollView>
  );
}
