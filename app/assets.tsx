import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { PremiumGate } from "@/components/PremiumGate";
import { useEntitlement } from "@/config/entitlements";
import { formatTRY } from "@/core/format";
import { formatShortDate } from "@/core/dates";
import { depositYield } from "@/core/deposit";
import { colors, spacing, typography } from "@/theme";

const KIND_LABELS: Record<string, string> = {
  cash: "Nakit", deposit: "Mevduat", fund: "Fon", stock: "Hisse",
  gold: "Altın", fx: "Döviz", commodity: "Emtia", crypto: "Kripto", other: "Diğer",
};

export default function Assets() {
  const router = useRouter();
  const data = useHousehold();
  const { features } = useEntitlement();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const addAsset = () =>
    features.canUseAssets ? router.push("/add-asset") : router.push("/paywall?feature=assets");
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };

  if (!features.canUseAssets) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
        <PremiumGate feature="assets" />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      <Card>
        <Text style={[typography.label, { color: colors.inkSoft }]}>Toplam varlık</Text>
        <Text style={[typography.statAmount, { color: colors.asset }]}>{formatTRY(data.totalAsset)}</Text>
      </Card>

      {data.assetViews.length === 0 ? (
        <Card><Text style={{ color: colors.muted }}>Henüz varlık yok.</Text></Card>
      ) : (
        <Card>
          {data.assetViews.map(({ asset: a, valueTRY, pnlTRY }) => {
            const dep =
              a.kind === "deposit" && a.annual_rate != null && a.term_days != null
                ? depositYield({
                    principal: Number(a.balance), annualRate: Number(a.annual_rate),
                    termDays: Number(a.term_days), stopaj: Number(a.stopaj ?? 0),
                    startDate: a.start_date ? new Date(a.start_date) : undefined,
                  })
                : null;
            const priced = ["fund", "stock", "gold", "commodity", "crypto"].includes(a.kind);
            return (
              <Pressable key={a.id} style={styles.row} onPress={() => router.push(`/add-asset?id=${a.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>{a.label}</Text>
                  <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                    {KIND_LABELS[a.kind] ?? a.kind}
                    {a.currency !== "TRY" ? ` · ${a.currency}` : ""}
                  </Text>
                  {dep && (
                    <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                      Vade sonu ≈ {formatTRY(dep.maturityValue)} · {formatShortDate(dep.maturityDate)}
                    </Text>
                  )}
                  {priced && a.last_price == null && (
                    <Text style={{ color: colors.inkSoft, fontSize: 13 }}>fiyat bekleniyor</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.asset, fontWeight: "700" }}>{formatTRY(valueTRY)}</Text>
                  {pnlTRY != null && (
                    <Text style={{ color: pnlTRY >= 0 ? colors.ok : colors.danger, fontSize: 12, fontWeight: "700" }}>
                      {pnlTRY >= 0 ? "▲ " : "▼ "}{formatTRY(Math.abs(pnlTRY))}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      <Button title="+ Varlık ekle" onPress={addAsset} />
    </ScrollView>
  );
}

const styles = {
  row: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
};
