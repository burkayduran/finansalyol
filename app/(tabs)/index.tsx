import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { Donut, Legend, BarsMonthly, type Slice } from "@/components/charts";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Donut dilim renkleri (navy ailesi + bakır vurgu + nötr tonlar).
const SLICE_COLORS = ["#233056", "#C2772E", "#3E5A8C", "#1E7F5C", "#9AA1B0", "#6C5CE7", "#B9770E"];

const KIND_LABELS: Record<string, string> = {
  cash: "Nakit",
  deposit: "Mevduat",
  fund: "Fon",
  stock: "Hisse",
  commodity: "Emtia",
  crypto: "Kripto",
  other: "Diğer",
};

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  const [donutView, setDonutView] = useState<"debt" | "asset">("debt");

  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const onRefresh = async () => {
    setRefreshing(true);
    await data.reload();
    setRefreshing(false);
  };

  const empty = data.debts.length === 0 && data.assets.length === 0;

  const debtSlices: Slice[] = data.byPerson.map((b, i) => ({
    label: b.person?.display_name ?? "Atanmamış",
    value: b.totalDebt,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const assetSlices: Slice[] = data.assetByKind.map((k, i) => ({
    label: KIND_LABELS[k.kind] ?? k.kind,
    value: k.value,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));

  const months = data.projection.slice(0, 6).map((m) => ({
    label: TR_MONTHS[m.month.getMonth()],
    income: m.income,
    outflow: m.expense + m.debtDue,
  }));
  const hasFlow = months.some((m) => m.income > 0 || m.outflow > 0);

  const assetTotal = data.totalAsset;
  const debtTotal = data.totalDebt;
  const ratioTotal = assetTotal + debtTotal;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 3.1 Net durum kartı + oran çubuğu */}
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
        {ratioTotal > 0 && (
          <View style={styles.ratioBar}>
            <View style={{ flex: assetTotal, backgroundColor: colors.asset }} />
            <View style={{ flex: debtTotal, backgroundColor: colors.debt }} />
          </View>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Toplam borç</Text>
            <Text style={{ color: colors.debt, fontSize: 18, fontWeight: "700" }}>{formatTRY(debtTotal)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Toplam birikim</Text>
            <Text style={{ color: colors.asset, fontSize: 18, fontWeight: "700" }}>{formatTRY(assetTotal)}</Text>
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
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>Panonu canlandır</Text>
          <Text style={{ color: colors.inkSoft, marginVertical: spacing(1) }}>
            Bir varlık, borç ya da gelir ekleyince pano dolu görünür.
          </Text>
          <Button title="Başla → Ekle sekmesine git" onPress={() => router.push("/add")} />
        </Card>
      )}

      {/* 3.2/3.3 Dağılım donut'u — Borç / Varlık geçişli */}
      {(debtSlices.length > 0 || assetSlices.length > 0) && (
        <Card>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => setDonutView("debt")}
              style={[styles.seg, donutView === "debt" && styles.segActive]}
            >
              <Text style={[styles.segText, donutView === "debt" && { color: colors.ink }]}>Borç dağılımı</Text>
            </Pressable>
            <Pressable
              onPress={() => setDonutView("asset")}
              style={[styles.seg, donutView === "asset" && styles.segActive]}
            >
              <Text style={[styles.segText, donutView === "asset" && { color: colors.ink }]}>Varlık dağılımı</Text>
            </Pressable>
          </View>
          {donutView === "debt" ? (
            debtSlices.length > 0 ? (
              <>
                <Donut data={debtSlices} centerValue={debtTotal} centerLabel="toplam borç" />
                <Legend data={debtSlices} />
              </>
            ) : (
              <Text style={styles.empty}>Borç yok.</Text>
            )
          ) : assetSlices.length > 0 ? (
            <>
              <Donut data={assetSlices} centerValue={assetTotal} centerLabel="toplam birikim" />
              <Legend data={assetSlices} />
            </>
          ) : (
            <Text style={styles.empty}>Varlık yok.</Text>
          )}
        </Card>
      )}

      {/* 3.4 Gelir-gider projeksiyonu — 6 ay çubuk */}
      {hasFlow && (
        <Card>
          <Text style={styles.section}>Önümüzdeki 6 ay</Text>
          <BarsMonthly months={months} />
          <View style={{ flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 6 }}>
            <Dot color={colors.asset} label="Gelir" />
            <Dot color={colors.inkSoft} label="Gider + borç" />
          </View>
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

      {/* 3.5 Yaklaşan ödemeler — liste (grafik değil) */}
      {data.upcoming.length > 0 && (
        <Card>
          <Text style={styles.section}>Yaklaşan ödemeler</Text>
          {data.upcoming.map((u) => (
            <Link key={u.debt.id} href={{ pathname: "/debt/[id]", params: { id: u.debt.id } }} asChild>
              <Pressable style={styles.row}>
                <View>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>{u.debt.label ?? u.debt.bank}</Text>
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
    </ScrollView>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = {
  section: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  empty: { color: colors.muted, textAlign: "center" as const, paddingVertical: spacing(2) },
  ratioBar: {
    flexDirection: "row" as const,
    height: 8,
    borderRadius: 4,
    overflow: "hidden" as const,
    backgroundColor: colors.line,
    marginTop: spacing(0.5),
  },
  toggle: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
  },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
};
