import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";

// Ekleme merkezi (hub). Net-değer / nakit-akışı gruplamasıyla.
// Borç YALNIZ buradan eklenir; ödemesi nakit-akışına otomatik akar (çift sayım yok).
export default function AddHub() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.group}>Net değer</Text>
        <Text style={styles.hint}>Sahip olduklarım ve borçlarım — bilanço.</Text>
        <Button title="+ Varlık ekle" onPress={() => router.push("/add-asset")} />
        <Button title="+ Borç ekle" variant="ghost" onPress={() => router.push("/add-debt")} />
      </Card>

      <Card>
        <Text style={styles.group}>Nakit akışı</Text>
        <Text style={styles.hint}>Giren ve çıkan para. Borç ödemeleri buraya otomatik yansır.</Text>
        <Button title="+ Gelir ekle" onPress={() => router.push("/add-cashflow?direction=income")} />
        <Button title="+ Gider ekle" variant="ghost" onPress={() => router.push("/add-cashflow?direction=expense")} />
      </Card>

      <View style={{ height: spacing(2) }} />
    </ScrollView>
  );
}

const styles = {
  group: { fontSize: 18, fontWeight: "800" as const, color: colors.ink },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing(1) },
};
