import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { colors, spacing, typography, FAMILY_SLICE_COLORS } from "@/theme";

interface DistItem { name: string; value: number; color: string }

export default function People() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };

  // Kişi rengi personCards sırasına bağlı — borç/varlık modu değişse de aynı kalır.
  const palette = FAMILY_SLICE_COLORS;
  const debtItems: DistItem[] = data.personCards
    .map((c, i) => ({ name: c.name, value: c.totalDebt, color: palette[i % palette.length] }))
    .filter((x) => x.value > 0);
  const assetItems: DistItem[] = data.personCards
    .map((c, i) => ({ name: c.name, value: c.totalAsset, color: palette[i % palette.length] }))
    .filter((x) => x.value > 0);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {data.personCards.length > 0 ? (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink }]}>Aile panosu</Text>
          <Text style={[typography.label, { color: colors.inkSoft }]}>
            {data.persons.length} kişi · en fazla 5
          </Text>

          <Distribution title="Borç dağılımı" items={debtItems} />
          <Distribution title="Varlık dağılımı" items={assetItems} />
        </Card>
      ) : (
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {/* Büyük tutar nötr (ink); renk yalnız küçük sinyal noktası. */}
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net < 0 ? colors.danger : colors.asset }} />
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}>{formatTRY(net)}</Text>
              </View>
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

function Distribution({ title, items }: { title: string; items: DistItem[] }) {
  const total = items.reduce((s, x) => s + x.value, 0);
  return (
    <View style={{ marginTop: spacing(1.5) }}>
      <Text style={[typography.label, { color: colors.inkSoft, marginBottom: 6 }]}>{title}</Text>
      {total <= 0 ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Kayıt yok.</Text>
      ) : (
        <>
          <View style={styles.bar}>
            {items.map((it) => (
              <View key={it.name} style={{ flex: it.value, backgroundColor: it.color }} />
            ))}
          </View>
          <Text style={{ color: colors.inkSoft, fontSize: 12, marginTop: 6 }}>
            {items.map((it) => `${it.name} %${Math.round((it.value / total) * 100)}`).join("  ·  ")}
          </Text>
        </>
      )}
    </View>
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

const styles = {
  bar: { flexDirection: "row" as const, height: 10, borderRadius: 5, overflow: "hidden" as const, backgroundColor: colors.line },
};
