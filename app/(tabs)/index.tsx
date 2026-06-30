import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { PaymentModal } from "@/components/PaymentModal";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { Donut, CashflowChartWrap } from "@/components/analytics";
import { formatTRY } from "@/core/format";
import { colors, spacing, typography } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const SLICE_COLORS = ["#233056", "#C2772E", "#3E5A8C", "#1E7F5C", "#9AA1B0", "#6C5CE7", "#B9770E"];

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);
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

  const empty = data.debts.length === 0 && data.assets.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 1 — Net Durum Hero */}
      <Card>
        <Text style={styles.label}>Net durum</Text>
        <Text style={[typography.heroAmount, { color: data.net < 0 ? colors.danger : colors.asset, marginVertical: 2 }]}>
          {formatTRY(data.net)}
        </Text>
        <View style={styles.statRow}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/debts")}>
            <Text style={styles.label}>Toplam borç ›</Text>
            <Text style={[typography.statAmount, { color: colors.ink }]}>{formatTRY(data.totalDebt)}</Text>
          </Pressable>
          <Pressable style={{ flex: 1, alignItems: "flex-end" }} onPress={() => router.push("/assets")}>
            <Text style={styles.label}>Toplam varlık ›</Text>
            <Text style={[typography.statAmount, { color: colors.ink }]}>{formatTRY(data.totalAsset)}</Text>
          </Pressable>
        </View>
      </Card>

      {empty && (
        <Card>
          <Text style={typography.cardTitle}>Hadi başlayalım</Text>
          <Text style={{ color: colors.inkSoft, marginVertical: spacing(1) }}>
            İlk borç, varlık veya gelirini ekleyince özetin canlanır.
          </Text>
          <Pressable onPress={() => router.push("/add")} style={styles.cta}>
            <Text style={{ color: colors.primaryInk, fontWeight: "700" }}>+ Ekle</Text>
          </Pressable>
        </Card>
      )}

      {/* 2 — Ödeme Özeti (tek kart) */}
      {!empty && (
        <Card>
          <Text style={typography.cardTitle}>Ödeme özeti</Text>

          <Text style={[styles.label, { marginTop: spacing(1) }]}>Bu ay kalan ödeme</Text>
          <Text style={[typography.statAmount, { color: colors.ink }]}>{formatTRY(data.thisMonthDue)}</Text>
          {data.thisMonthTotal > 0 && (
            <>
              <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 2 }}>
                Ödendi: {formatTRY(data.thisMonthPaid)} · Toplam: {formatTRY(data.thisMonthTotal)}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((data.thisMonthPaid / data.thisMonthTotal) * 100))}%` }]} />
              </View>
            </>
          )}

          <Text style={[styles.label, { marginTop: spacing(2) }]}>Yaklaşanlar</Text>
          {data.urgentOccurrences.length === 0 ? (
            <Text style={{ color: colors.muted, paddingVertical: spacing(0.5) }}>Bekleyen ödeme yok.</Text>
          ) : (
            data.urgentOccurrences.slice(0, 3).map((o) => (
              <OccurrenceRow
                key={o.id}
                occ={o}
                personName={o.owner_type === "household" ? "Ortak" : personName.get(o.person_id ?? "") ?? "—"}
                onPay={() => openPay(o)}
              />
            ))
          )}

          {data.next3Months.some((m) => m.total > 0) && (
            <>
              <Text style={[styles.label, { marginTop: spacing(2) }]}>Gelecek aylar</Text>
              <Text style={{ color: colors.inkSoft }}>
                {data.next3Months.map((m) => `${TR_MONTHS[m.month.getMonth()]} ${formatTRY(m.total)}`).join("  ·  ")}
              </Text>
            </>
          )}

          <Pressable onPress={() => router.push("/calendar")} style={{ paddingTop: spacing(1.5) }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Tümünü gör →</Text>
          </Pressable>
        </Card>
      )}

      {/* 3 — Aile kırılımı (kompakt) */}
      {data.personCards.length > 0 && (
        <Card>
          <Text style={typography.cardTitle}>Aile kırılımı</Text>
          {data.personCards.map((c) => {
            const net = c.totalAsset - c.totalDebt;
            return (
              <Pressable
                key={c.key}
                style={styles.personRow}
                onPress={() => router.push(c.isHousehold ? "/household" : `/person/${c.person!.id}`)}
              >
                <Text style={{ color: colors.ink, fontWeight: "700" }}>{c.name}</Text>
                <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                  Net <Text style={{ color: net < 0 ? colors.danger : colors.asset, fontWeight: "700" }}>{formatTRY(net)}</Text>
                  {"  ·  Bu ay "}{formatTRY(c.thisMonthPayment)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      )}

      {/* 4 — Analizler (kompakt, en altta) */}
      {!empty && (
        <>
          <Text style={[typography.cardTitle, { marginTop: spacing(1), marginBottom: spacing(0.5) }]}>Analizler</Text>
          <Donut personCards={data.personCards} colors={SLICE_COLORS} />
          <CashflowChartWrap projection={data.projection} onDetail={() => router.push("/cashflow")} />
        </>
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

const styles = {
  label: { ...typography.label, color: colors.muted },
  statRow: { flexDirection: "row" as const, marginTop: spacing(1.5) },
  cta: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" as const },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: spacing(0.75), overflow: "hidden" as const },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  personRow: { paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
};
