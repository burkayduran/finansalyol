import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { PaymentModal } from "@/components/PaymentModal";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { Donut, Legend, type Slice } from "@/components/charts";
import { CashflowChart, type CashflowMonth } from "@/components/CashflowChart";
import { skipOccurrence } from "@/lib/occurrences";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const SLICE_COLORS = ["#233056", "#C2772E", "#3E5A8C", "#1E7F5C", "#9AA1B0", "#6C5CE7", "#B9770E"];
const KIND_LABELS: Record<string, string> = {
  cash: "Nakit", deposit: "Mevduat", fund: "Fon", stock: "Hisse",
  gold: "Altın", fx: "Döviz", commodity: "Emtia", crypto: "Kripto", other: "Diğer",
};

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
  const [donutView, setDonutView] = useState<"debt" | "asset">("debt");
  const [selMonth, setSelMonth] = useState<string | undefined>(undefined);
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);

  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));
  const onRefresh = async () => { setRefreshing(true); await data.reload(); setRefreshing(false); };

  const debtById = useMemo(() => {
    const m = new Map<string, Debt>();
    data.debts.forEach((d) => m.set(d.id, d));
    return m;
  }, [data.debts]);
  const personName = useMemo(() => {
    const m = new Map<string, string>();
    data.persons.forEach((p) => m.set(p.id, p.display_name));
    return m;
  }, [data.persons]);

  const openPay = (occ: PaymentOccurrence) => {
    const debt = occ.debt_id ? debtById.get(occ.debt_id) : null;
    if (debt) setPayTarget({ debt, occ });
  };

  const debtSlices: Slice[] = data.personCards
    .filter((c) => c.totalDebt > 0)
    .map((c, i) => ({ label: c.name, value: c.totalDebt, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
  const assetSlices: Slice[] = data.assetByKind.map((k, i) => ({
    label: KIND_LABELS[k.kind] ?? k.kind, value: k.value, color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const cashflowMonths: CashflowMonth[] = data.projection.slice(0, 6).map((m) => ({
    monthKey: m.month.toISOString(),
    label: TR_MONTHS[m.month.getMonth()],
    income: m.income,
    outflow: m.expense + m.debtDue,
    net: m.income - m.expense - m.debtDue,
  }));
  const hasFlow = cashflowMonths.some((m) => m.income > 0 || m.outflow > 0);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Ana özet kartı — aksiyon odaklı */}
      <Card>
        <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Bu ay ödenecek</Text>
        <Text style={{ color: colors.ink, fontSize: 36, fontWeight: "800", marginVertical: 2 }}>
          {formatTRY(data.thisMonthTotal > 0 ? data.thisMonthTotal : data.thisMonthDue)}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
          {data.thisMonthOpenCount} ödeme bekliyor · {data.thisWeekCount} ödeme bu hafta
        </Text>

        {data.thisMonthTotal > 0 && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
              <Text style={{ color: colors.asset, fontSize: 13 }}>Ödendi: {formatTRY(data.thisMonthPaid)}</Text>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Kalan: {formatTRY(data.thisMonthDue)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((data.thisMonthPaid / data.thisMonthTotal) * 100))}%` }]} />
            </View>
          </>
        )}

        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: spacing(1.5) }} />
        <Pressable onPress={() => router.push("/debts")}>
          <Stat label="Toplam borç ›" value={formatTRY(data.totalDebt)} color={colors.debt} />
        </Pressable>
        <Pressable onPress={() => router.push("/assets")}>
          <Stat label="Toplam varlık ›" value={formatTRY(data.totalAsset)} color={colors.asset} />
        </Pressable>
        <Stat label="Net durum" value={formatTRY(data.net)} color={data.net < 0 ? colors.danger : colors.asset} bold />
      </Card>

      {data.debts.length === 0 && data.assets.length === 0 && (
        <Card>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>Hadi başlayalım</Text>
          <Text style={{ color: colors.inkSoft, marginVertical: spacing(1) }}>
            İlk borç, varlık veya gelirini ekleyince özetin canlanır.
          </Text>
          <Pressable onPress={() => router.push("/add")} style={styles.cta}>
            <Text style={{ color: colors.primaryInk, fontWeight: "700" }}>+ Ekle</Text>
          </Pressable>
        </Card>
      )}

      {/* Yaklaşan ödemeler */}
      <Card>
        <Text style={styles.section}>Yaklaşan ödemeler</Text>
        {data.urgentOccurrences.length === 0 ? (
          <View>
            <Text style={styles.empty}>Henüz yaklaşan ödeme yok.</Text>
            <Pressable onPress={() => router.push("/add-debt")}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Borç / ödeme ekle</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {data.urgentOccurrences.slice(0, 3).map((o) => (
              <OccurrenceRow
                key={o.id}
                occ={o}
                personName={o.owner_type === "household" ? "Ortak" : personName.get(o.person_id ?? "") ?? "—"}
                onPay={() => openPay(o)}
                onSkip={() => skipOccurrence(o.id).then(() => data.reload())}
              />
            ))}
            <Pressable onPress={() => router.push("/calendar")} style={{ paddingTop: spacing(1) }}>
              <Text style={{ color: colors.primary, fontWeight: "700", textAlign: "center" }}>Tümünü gör</Text>
            </Pressable>
          </>
        )}
      </Card>

      {/* Kişi kartları */}
      {data.personCards.length > 0 && (
        <Card>
          <Text style={styles.section}>Kişi bazında durum</Text>
          {data.personCards.map((c) => (
            <Pressable
              key={c.key}
              style={styles.personCard}
              onPress={() => router.push(c.isHousehold ? "/household" : `/person/${c.person!.id}`)}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>{c.name}</Text>
                <Text style={{ color: (c.totalAsset - c.totalDebt) < 0 ? colors.danger : colors.asset, fontWeight: "800" }}>
                  {formatTRY(c.totalAsset - c.totalDebt)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing(2), marginTop: 4, flexWrap: "wrap" }}>
                <Mini label="Borç" value={formatTRY(c.totalDebt)} color={colors.debt} />
                <Mini label="Varlık" value={formatTRY(c.totalAsset)} color={colors.asset} />
                <Mini label="Bu ay ödeme" value={formatTRY(c.thisMonthPayment)} color={colors.ink} />
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {/* Gelecek 3 ay */}
      {data.next3Months.some((m) => m.total > 0) && (
        <Card>
          <Pressable onPress={() => router.push("/calendar")}>
            <Text style={styles.section}>Gelecek ödeme planı</Text>
            {data.next3Months.map((m) => (
              <View key={m.month.toISOString()} style={styles.row}>
                <Text style={{ color: colors.ink }}>{TR_MONTHS[m.month.getMonth()]} {m.month.getFullYear()}</Text>
                <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(m.total)}</Text>
              </View>
            ))}
          </Pressable>
        </Card>
      )}

      {/* Analizler — en altta, aksiyonları aşağı itmez */}
      {(debtSlices.length > 0 || assetSlices.length > 0 || hasFlow) && (
        <Text style={[styles.section, { marginTop: spacing(1) }]}>Analizler</Text>
      )}

      {(debtSlices.length > 0 || assetSlices.length > 0) && (
        <Card>
          <Text style={styles.cardTitle}>Borç-varlık dağılımı</Text>
          <View style={styles.toggle}>
            <Pressable onPress={() => setDonutView("debt")} style={[styles.seg, donutView === "debt" && styles.segActive]}>
              <Text style={[styles.segText, donutView === "debt" && { color: colors.ink }]}>Borç</Text>
            </Pressable>
            <Pressable onPress={() => setDonutView("asset")} style={[styles.seg, donutView === "asset" && styles.segActive]}>
              <Text style={[styles.segText, donutView === "asset" && { color: colors.ink }]}>Varlık</Text>
            </Pressable>
          </View>
          {donutView === "debt" ? (
            debtSlices.length > 0 ? <><Donut data={debtSlices} size={150} centerValue={data.totalDebt} centerLabel="toplam borç" /><Legend data={debtSlices} /></> : <Text style={styles.empty}>Borç yok.</Text>
          ) : assetSlices.length > 0 ? (
            <><Donut data={assetSlices} size={150} centerValue={data.totalAsset} centerLabel="toplam varlık" /><Legend data={assetSlices} /></>
          ) : <Text style={styles.empty}>Varlık yok.</Text>}
        </Card>
      )}

      {hasFlow && (
        <Card>
          <Text style={styles.cardTitle}>Nakit akışı · planlanan</Text>
          <CashflowChart data={cashflowMonths} selectedMonthKey={selMonth} onSelectMonth={setSelMonth} />
          <Pressable onPress={() => router.push("/cashflow")}>
            <Text style={{ color: colors.primary, fontWeight: "700", textAlign: "center", marginTop: 8 }}>
              Detayı gör →
            </Text>
          </Pressable>
        </Card>
      )}

      <PaymentModal
        visible={payTarget != null}
        householdId={(payTarget && payTarget.debt.household_id) ?? ""}
        debt={payTarget?.debt ?? null}
        occurrence={payTarget?.occ ?? null}
        onClose={() => setPayTarget(null)}
        onSaved={() => data.reload()}
      />
    </ScrollView>
  );
}

function Stat({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text style={{ color, fontWeight: bold ? "800" : "700", fontSize: bold ? 18 : 15 }}>{value}</Text>
    </View>
  );
}
function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const styles = {
  section: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  cardTitle: { fontSize: 15, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  empty: { color: colors.muted, paddingVertical: spacing(1) },
  cta: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" as const },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: spacing(0.75), overflow: "hidden" as const },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(0.75) },
  personCard: { paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
  toggle: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: "center" as const },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
};
