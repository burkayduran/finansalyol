import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";

export default function People() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {data.personCards.length === 0 && (
        <Card>
          <Text style={{ color: colors.inkSoft }}>Henüz kişi yok. Aile bölümünden kişi ekle.</Text>
        </Card>
      )}

      {data.personCards.map((c) => {
        const net = c.totalAsset - c.totalDebt;
        return (
          <Pressable
            key={c.key}
            onPress={() => router.push(c.isHousehold ? "/household" : `/person/${c.person!.id}`)}
          >
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.ink }}>{c.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {c.upcomingCount > 0 ? `${c.upcomingCount} yaklaşan` : "yaklaşan yok"}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing(0.5) }}>Net durum</Text>
              <Text style={{ color: net < 0 ? colors.danger : colors.asset, fontSize: 20, fontWeight: "800" }}>
                {formatTRY(net)}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
                <Cell label="Borç" value={formatTRY(c.totalDebt)} color={colors.debt} />
                <Cell label="Varlık" value={formatTRY(c.totalAsset)} color={colors.asset} />
                <Cell label="Bu ay ödeme" value={formatTRY(c.thisMonthPayment)} color={colors.ink} />
              </View>
              <Text style={{ color: colors.primary, fontWeight: "700", marginTop: spacing(1) }}>Detay →</Text>
            </Card>
          </Pressable>
        );
      })}

      <Button title="+ Kişi ekle" variant="ghost" onPress={() => router.push("/family")} />
    </ScrollView>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
