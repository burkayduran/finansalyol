import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { PaymentModal } from "@/components/PaymentModal";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { Donut, CashflowChartWrap } from "@/components/analytics";
import { ConsultCTA } from "@/components/ConsultCTA";
import { PremiumGate } from "@/components/PremiumGate";
import { useEntitlement } from "@/config/entitlements";
import { formatTRY } from "@/core/format";
import { colors, spacing, typography, FAMILY_SLICE_COLORS } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const { features } = useEntitlement();
  const [refreshing, setRefreshing] = useState(false);
  const openAssets = () =>
    features.canUseAssets ? router.push("/assets") : router.push("/paywall?feature=assets");
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

  const ratioTotal = data.totalAsset + data.totalDebt;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      {/* 1 — Net Durum Hero + oran çubuğu */}
      <Card>
        <Text style={styles.label}>Net durum</Text>
        <Text style={[typography.heroAmount, { color: colors.ink, marginVertical: 2 }]}>{formatTRY(data.net)}</Text>
        {ratioTotal > 0 && (
          <>
            <View style={styles.ratioLabelRow}>
              <Text style={styles.ratioLabel}>Varlık</Text>
              <Text style={styles.ratioLabel}>Borç</Text>
            </View>
            <View style={styles.ratioBar}>
              <View style={{ flex: Math.max(0.001, data.totalAsset), backgroundColor: colors.asset }} />
              <View style={{ flex: Math.max(0.001, data.totalDebt), backgroundColor: colors.debt }} />
            </View>
          </>
        )}
        <View style={styles.statRow}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/debts")}>
            <Text style={styles.label}>Toplam borç ›</Text>
            <Text style={[typography.statAmount, { color: colors.ink }]}>{formatTRY(data.totalDebt)}</Text>
          </Pressable>
          <Pressable style={{ flex: 1, alignItems: "flex-end" }} onPress={openAssets}>
            <Text style={styles.label}>Toplam varlık ›</Text>
            <Text style={[typography.statAmount, { color: colors.ink }]}>
              {features.canUseAssets ? formatTRY(data.totalAsset) : "•••"}
            </Text>
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

      {/* 2 — Varlık vs Borç görseli (kişi bazlı donut) */}
      {!empty && <Donut personCards={data.personCards} colors={FAMILY_SLICE_COLORS} />}

      {/* 3 — Ödeme Özeti (tek kart) */}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {data.next3Months.map((m, i) => (
                  <View key={m.month.toISOString()} style={[styles.monthChip, i === 0 && styles.monthChipCurrent]}>
                    <Text style={{ color: colors.ink, fontSize: 12 }}>
                      {TR_MONTHS[m.month.getMonth()]} {formatTRY(m.total)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          <Pressable onPress={() => router.push("/calendar")} style={{ paddingTop: spacing(1.5) }}>
            <Text style={styles.tertiaryLink}>Tümünü gör →</Text>
          </Pressable>
        </Card>
      )}

      {/* 4 — Nakit akışı: premium veri veya free teaser */}
      {!empty && (
        features.canUseCashflow ? (
          <CashflowChartWrap projection={data.projection} onDetail={() => router.push("/cashflow")} />
        ) : (
          <PremiumGate feature="cashflow" />
        )
      )}

      {/* 5 — Borç Azaltma Planı danışmanlık CTA (nakit akışının hemen altında) */}
      {!empty && <ConsultCTA />}

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
  label: { ...typography.label, color: colors.inkSoft },
  statRow: { flexDirection: "row" as const, marginTop: spacing(1.5) },
  cta: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" as const },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: spacing(0.75), overflow: "hidden" as const },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  ratioLabelRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginTop: spacing(1) },
  ratioLabel: { fontSize: 11, color: colors.inkSoft },
  ratioBar: { flexDirection: "row" as const, height: 6, borderRadius: 3, overflow: "hidden" as const, backgroundColor: colors.line, marginTop: 4 },
  chipRow: { flexDirection: "row" as const, gap: 6, marginTop: 4, paddingRight: spacing(1) },
  monthChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoft },
  monthChipCurrent: { borderColor: colors.accent },
  tertiaryLink: { color: colors.accent, fontWeight: "700" as const },
};
