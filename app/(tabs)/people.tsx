import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { PremiumGate } from "@/components/PremiumGate";
import { useEntitlement } from "@/config/entitlements";
import { formatTRY } from "@/core/format";
import { colors, spacing, typography, FAMILY_SLICE_COLORS } from "@/theme";

export default function People() {
  const router = useRouter();
  const data = useHousehold();
  const { features } = useEntitlement();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };
  const addPerson = () =>
    features.canUseFamily ? router.push("/family") : router.push("/paywall?feature=family");

  const palette = FAMILY_SLICE_COLORS;
  // Kişi rengi personCards sırasına sabit (borç/varlık modu değişse de aynı).
  const debtRows = data.personCards
    .map((c, i) => ({ name: c.name, value: c.totalDebt, color: palette[i % palette.length] }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalDebt = debtRows.reduce((s, r) => s + r.value, 0);
  const maxDebt = Math.max(1, ...debtRows.map((r) => r.value));

  // Free kullanıcı gerçek aile datasını görmez; teaser + paywall.
  if (!features.canUseFamily) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
        <PremiumGate feature="family" />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {data.personCards.length === 0 ? (
        <Card>
          <Text style={[typography.label, { color: colors.inkSoft }]}>Henüz kişi yok. Aile bölümünden kişi ekle.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={[typography.cardTitle, { color: colors.ink }]}>Aile borç dağılımı</Text>
            <Text style={[typography.label, { color: colors.inkSoft, marginBottom: spacing(1) }]}>
              {data.persons.length} kişi · en fazla 5
            </Text>
            {debtRows.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>Borç yok.</Text>
            ) : (
              debtRows.map((r) => (
                <DebtBar key={r.name} name={r.name} value={r.value} pct={r.value / maxDebt} share={r.value / totalDebt} color={r.color} />
              ))
            )}
          </Card>

          <Card>
            <Text style={[typography.cardTitle, { color: colors.ink, marginBottom: spacing(1) }]}>Bu ay ödeme yükü</Text>
            {data.personCards.map((c) => (
              <View key={c.key} style={styles.payRow}>
                <Text style={{ color: colors.ink }} numberOfLines={1}>{c.name}</Text>
                <Text style={{ color: c.thisMonthPayment > 0 ? colors.ink : colors.muted, fontWeight: "700" }}>
                  {c.thisMonthPayment > 0 ? formatTRY(c.thisMonthPayment) : "ödeme yok"}
                </Text>
              </View>
            ))}
          </Card>
        </>
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

      <Button title="+ Kişi ekle" variant="ghost" onPress={addPerson} />
    </ScrollView>
  );
}

function DebtBar({ name, value, pct, share, color }: { name: string; value: number; pct: number; share: number; color: string }) {
  return (
    <View style={{ marginBottom: spacing(1) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: colors.ink, fontSize: 13 }} numberOfLines={1}>{name}</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
          {formatTRY(value)} · %{Math.round(share * 100)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={{ width: `${Math.max(4, Math.round(pct * 100))}%`, backgroundColor: color, height: 12, borderRadius: 6 }} />
      </View>
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
  track: { height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: "hidden" as const },
  payRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 4 },
};
