import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { formatShortDate } from "@/core/dates";
import { depositYield } from "@/core/deposit";
import { colors, spacing } from "@/theme";

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);

  // Sekmeye her dönüşte tazele (yeni borç/ödeme yansısın).
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const onRefresh = async () => {
    setRefreshing(true);
    await data.reload();
    setRefreshing(false);
  };

  const empty = data.debts.length === 0 && data.assets.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Net durum kartı — sade beyaz kart; marka rengi büyük alanı boyamaz */}
      <Card>
        <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Net durum</Text>
        <Text
          style={{
            color: data.net < 0 ? colors.danger : colors.ink,
            fontSize: 34,
            fontWeight: "800",
            marginVertical: 4,
          }}
        >
          {formatTRY(data.net)}
        </Text>
        <View style={{ height: 2, backgroundColor: colors.accent, width: 48, borderRadius: 2, marginVertical: spacing(1) }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Toplam borç</Text>
            <Text style={{ color: colors.debt, fontSize: 18, fontWeight: "700" }}>
              {formatTRY(data.totalDebt)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Toplam birikim</Text>
            <Text style={{ color: colors.asset, fontSize: 18, fontWeight: "700" }}>
              {formatTRY(data.totalAsset)}
            </Text>
          </View>
        </View>
        {data.cashFlows.length > 0 && (
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: spacing(1) }}>
            Bu ay net ≈{" "}
            <Text style={{ color: data.monthlyNet < 0 ? colors.danger : colors.ink, fontWeight: "700" }}>
              {formatTRY(data.monthlyNet)}
            </Text>
          </Text>
        )}
      </Card>

      {empty && (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>
            İlk hesabını ekle
          </Text>
          <Text style={{ color: colors.inkSoft, marginVertical: spacing(1) }}>
            Bir borç ya da birikim ekleyince pano canlanır. Sonra aileni davet edebilirsin.
          </Text>
          <Button title="Borç ekle" onPress={() => router.push("/add-debt")} />
          <Button title="Birikim ekle" variant="ghost" onPress={() => router.push("/add-asset")} />
        </Card>
      )}

      {/* Kişi kırılımı */}
      {data.byPerson.length > 0 && (
        <Card>
          <Text style={styles.section}>Kim ne kadar borçlu</Text>
          {data.byPerson.map((b, i) => (
            <View key={b.person?.id ?? `orphan-${i}`} style={styles.row}>
              <Text style={{ color: colors.ink }}>{b.person?.display_name ?? "Atanmamış"}</Text>
              <Text style={{ color: colors.debt, fontWeight: "700" }}>{formatTRY(b.totalDebt)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Birikimler (TRY değer + kâr/zarar rozeti; mevduatta vade sonu) */}
      {data.assetViews.length > 0 && (
        <Card>
          <Text style={styles.section}>Birikimler</Text>
          {data.assetViews.map(({ asset: a, valueTRY, pnlTRY }) => {
            const dep =
              a.kind === "deposit" && a.annual_rate != null && a.term_days != null
                ? depositYield({
                    principal: Number(a.balance),
                    annualRate: Number(a.annual_rate),
                    termDays: Number(a.term_days),
                    stopaj: Number(a.stopaj ?? 0),
                    startDate: a.start_date ? new Date(a.start_date) : undefined,
                  })
                : null;
            return (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>{a.label}</Text>
                  {dep && (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      Vade sonu ≈ {formatTRY(dep.maturityValue)} · {formatShortDate(dep.maturityDate)}
                    </Text>
                  )}
                  {a.last_price == null && (a.kind === "fund" || a.kind === "stock" || a.kind === "commodity" || a.kind === "crypto") && (
                    <Text style={{ color: colors.muted, fontSize: 13 }}>fiyat bekleniyor</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.asset, fontWeight: "700" }}>{formatTRY(valueTRY)}</Text>
                  {pnlTRY != null && (
                    <Text style={{ color: pnlTRY >= 0 ? colors.ok : colors.danger, fontSize: 12, fontWeight: "700" }}>
                      {pnlTRY >= 0 ? "▲ " : "▼ "}
                      {formatTRY(Math.abs(pnlTRY))}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* Gelecek aylar (taksit projeksiyonu) giriş noktası */}
      {data.debts.some((d) => d.kind === "loan" || d.kind === "kmh_installment") && (
        <Card>
          <Pressable style={[styles.row, { borderTopWidth: 0 }]} onPress={() => router.push("/projection")}>
            <Text style={{ color: colors.ink, fontWeight: "600" }}>Gelecek aylar</Text>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>12 aylık plan →</Text>
          </Pressable>
        </Card>
      )}

      {/* Yaklaşan ödemeler */}
      {data.upcoming.length > 0 && (
        <Card>
          <Text style={styles.section}>Yaklaşan ödemeler</Text>
          {data.upcoming.map((u) => (
            <Link key={u.debt.id} href={{ pathname: "/debt/[id]", params: { id: u.debt.id } }} asChild>
              <Pressable style={styles.row}>
                <View>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {u.debt.label ?? u.debt.bank}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {u.days === 0 ? "Bugün son gün" : `${u.days} gün sonra`}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  {u.minimum > 0 ? formatTRY(u.minimum) : formatTRY(Number(u.debt.balance))}
                </Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      )}

      {!empty && (
        <View style={{ marginTop: spacing(1) }}>
          <Button title="+ Borç ekle" onPress={() => router.push("/add-debt")} />
          <Button title="+ Birikim ekle" variant="ghost" onPress={() => router.push("/add-asset")} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = {
  section: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
};
