import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { PaymentModal } from "@/components/PaymentModal";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { Donut, Legend, BarsMonthly, type Slice } from "@/components/charts";
import { formatTRY } from "@/core/format";
import { daysUntilDue } from "@/core/dates";
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
  const months = data.projection.slice(0, 6).map((m) => ({
    label: TR_MONTHS[m.month.getMonth()], income: m.income, outflow: m.expense + m.debtDue,
  }));
  const hasFlow = months.some((m) => m.income > 0 || m.outflow > 0);

  const mostUrgent = data.urgentOccurrences[0];

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Ana özet kartı — aksiyon odaklı */}
      <Card>
        <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Bu ay ödenecek</Text>
        <Text style={{ color: colors.ink, fontSize: 36, fontWeight: "800", marginVertical: 2 }}>
          {formatTRY(data.thisMonthDue)}
        </Text>
        {mostUrgent && (
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: spacing(1) }}>
            Yaklaşan: {mostUrgent.bank_name ?? mostUrgent.label ?? "Ödeme"} ·{" "}
            {daysUntilDue(new Date(mostUrgent.due_date).getDate()) === 0
              ? "bugün"
              : `${Math.max(0, Math.round((new Date(mostUrgent.due_date).getTime() - Date.now()) / 86400000))} gün`}{" "}
            · {formatTRY(Math.max(0, Number(mostUrgent.amount_due) - Number(mostUrgent.amount_paid)))}
          </Text>
        )}
        <View style={{ height: 2, backgroundColor: colors.accent, width: 48, borderRadius: 2, marginVertical: spacing(1) }} />
        <Stat label="Toplam borç" value={formatTRY(data.totalDebt)} color={colors.debt} />
        <Stat label="Toplam varlık" value={formatTRY(data.totalAsset)} color={colors.asset} />
        <Stat label="Net durum" value={formatTRY(data.net)} color={data.net < 0 ? colors.danger : colors.ink} bold />
      </Card>

      {/* Yaklaşan ödemeler (en acil 3) */}
      <Card>
        <Text style={styles.section}>Yaklaşan ödemeler</Text>
        {data.urgentOccurrences.length === 0 ? (
          <Text style={styles.empty}>Bekleyen ödeme yok.</Text>
        ) : (
          data.urgentOccurrences.map((o) => (
            <OccurrenceRow
              key={o.id}
              occ={o}
              personName={o.owner_type === "household" ? "Ortak" : personName.get(o.person_id ?? "") ?? "—"}
              onPay={() => openPay(o)}
            />
          ))
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
              onPress={() => !c.isHousehold && c.person && router.push(`/person/${c.person.id}`)}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>{c.name}</Text>
                {c.upcomingCount > 0 && (
                  <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{c.upcomingCount} yaklaşan ödeme</Text>
                )}
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

      {/* Analiz / grafikler — en altta */}
      {(debtSlices.length > 0 || assetSlices.length > 0) && (
        <Card>
          <View style={styles.toggle}>
            <Pressable onPress={() => setDonutView("debt")} style={[styles.seg, donutView === "debt" && styles.segActive]}>
              <Text style={[styles.segText, donutView === "debt" && { color: colors.ink }]}>Borç dağılımı</Text>
            </Pressable>
            <Pressable onPress={() => setDonutView("asset")} style={[styles.seg, donutView === "asset" && styles.segActive]}>
              <Text style={[styles.segText, donutView === "asset" && { color: colors.ink }]}>Varlık dağılımı</Text>
            </Pressable>
          </View>
          {donutView === "debt" ? (
            debtSlices.length > 0 ? <><Donut data={debtSlices} centerValue={data.totalDebt} centerLabel="toplam borç" /><Legend data={debtSlices} /></> : <Text style={styles.empty}>Borç yok.</Text>
          ) : assetSlices.length > 0 ? (
            <><Donut data={assetSlices} centerValue={data.totalAsset} centerLabel="toplam varlık" /><Legend data={assetSlices} /></>
          ) : <Text style={styles.empty}>Varlık yok.</Text>}
        </Card>
      )}

      {hasFlow && (
        <Card>
          <Text style={styles.section}>Gelir-gider (6 ay)</Text>
          <BarsMonthly months={months} />
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
  empty: { color: colors.muted, paddingVertical: spacing(1) },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(0.75) },
  personCard: { paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
  toggle: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: "center" as const },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
};
