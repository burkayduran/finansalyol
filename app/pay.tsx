import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { effectiveStatus } from "@/core/paymentOccurrences";
import { formatTRY } from "@/core/format";
import { track } from "@/lib/analytics";
import { colors, spacing, typography } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

// "Ekle > Ödeme gir" — iki bölüm: (1) bekleyen ödeme occurrence'ları,
// (2) aktif borçtan manuel ödeme. İkisi de PaymentModal açar.
export default function Pay() {
  const router = useRouter();
  const data = useHousehold();
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence | null } | null>(null);

  useFocusEffect(useCallback(() => { data.reload(); track("pay_screen_opened"); }, [data.reload]));

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
  const nameFor = (o: PaymentOccurrence) =>
    o.owner_type === "household" ? "Ortak" : personName.get(o.person_id ?? "") ?? "—";

  const open = useMemo(
    () =>
      data.occurrences
        .filter((o) => {
          const s = effectiveStatus(o);
          return s === "pending" || s === "partial" || s === "overdue";
        })
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [data.occurrences]
  );
  const activeDebts = useMemo(() => data.debts.filter((d) => d.is_active !== false), [data.debts]);

  const openOccurrence = (occ: PaymentOccurrence) => {
    const debt = occ.debt_id ? debtById.get(occ.debt_id) : null;
    if (debt) setPayTarget({ debt, occ });
  };
  const openManual = (debt: Debt) => setPayTarget({ debt, occ: null });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      {/* Bölüm 1 — Bekleyen ödemeler */}
      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink }]}>Bekleyen ödemeler</Text>
        {open.length === 0 ? (
          <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>
            Bekleyen ödeme bulunamadı.{"\n"}Aşağıdan aktif bir borca manuel ödeme girebilirsin.
          </Text>
        ) : (
          open.map((o) => (
            <OccurrenceRow key={o.id} occ={o} personName={nameFor(o)} onPay={() => openOccurrence(o)} />
          ))
        )}
      </Card>

      {/* Bölüm 2 — Borçtan manuel ödeme */}
      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink }]}>Borçtan manuel ödeme gir</Text>
        {activeDebts.length === 0 ? (
          <>
            <Text style={{ color: colors.inkSoft, marginTop: spacing(1), marginBottom: spacing(1.5) }}>
              Ödeme girilecek aktif borç bulunamadı.{"\n"}Önce bir borç ekleyebilirsin.
            </Text>
            <Button title="Borç ekle" variant="ghost" onPress={() => router.push("/add-debt")} />
          </>
        ) : (
          activeDebts.map((d) => (
            <Pressable key={d.id} style={styles.debtRow} onPress={() => openManual(d)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: "600" }} numberOfLines={1}>
                  {d.bank_name ?? d.bank}{d.label ? ` · ${d.label}` : ""}
                </Text>
                <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                  Kalan {formatTRY(data.debtOutstanding(d))}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13, marginLeft: spacing(1) }}>
                Ödeme gir →
              </Text>
            </Pressable>
          ))
        )}
      </Card>

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
  debtRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
};
