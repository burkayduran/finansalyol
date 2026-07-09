import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { colors, spacing, typography } from "@/theme";

export default function People() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {data.personCards.length > 0 && (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink }]}>Aile özeti</Text>
          <Text style={[typography.label, { color: colors.inkSoft, marginTop: spacing(1) }]}>Net durum</Text>
          <Text style={{ color: data.net < 0 ? colors.danger : colors.ink, fontSize: 22, fontWeight: "800" }}>
            {formatTRY(data.net)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing(1) }}>
            <SummaryCell label="Toplam borç" value={formatTRY(data.totalDebt)} />
            <SummaryCell label="Toplam varlık" value={formatTRY(data.totalAsset)} />
            <SummaryCell label="Bu ay ödenecek" value={formatTRY(data.thisMonthDue)} />
            <SummaryCell label="Kişi sayısı" value={`${data.persons.length}/5`} />
          </View>
        </Card>
      )}

      {data.personCards.length === 0 && (
        <Card>
          <Text style={[typography.label, { color: colors.inkSoft }]}>Henüz kişi yok. Aile bölümünden kişi ekle.</Text>
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
                <Text style={[typography.cardTitle, { color: colors.ink }]}>{c.name}</Text>
                <Text style={[typography.label, { color: colors.inkSoft }]}>
                  {c.upcomingCount > 0 ? `${c.upcomingCount} yaklaşan` : "yaklaşan yok"}
                </Text>
              </View>
              <Text style={[typography.label, { color: colors.inkSoft, marginTop: spacing(1) }]}>Net durum</Text>
              <Text style={{ color: net < 0 ? colors.danger : colors.asset, fontSize: 18, fontWeight: "800" }}>
                {formatTRY(net)}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
                <Cell label="Borç" value={formatTRY(c.totalDebt)} />
                <Cell label="Varlık" value={formatTRY(c.totalAsset)} />
                <Cell label="Bu ay ödeme" value={formatTRY(c.thisMonthPayment)} />
              </View>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13, marginTop: spacing(1) }}>Detay →</Text>
            </Card>
          </Pressable>
        );
      })}

      <Button title="+ Kişi ekle" variant="ghost" onPress={() => router.push("/family")} />
    </ScrollView>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={[typography.label, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: 4 }}>
      <Text style={[typography.label, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
