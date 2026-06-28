import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default function Calendar() {
  const data = useHousehold();
  const [tab, setTab] = useState<"month" | "future">("month");
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

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

  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1);
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const thisMonth = data.occurrences
    .filter((o) => { const d = new Date(o.due_date); return d >= ms && d <= me; })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const futureMonths = useMemo(() => {
    const map = new Map<string, number>();
    data.occurrences
      .filter((o) => o.status === "pending" || o.status === "partial" || o.status === "overdue")
      .filter((o) => new Date(o.due_date) > me)
      .forEach((o) => {
        const d = new Date(o.due_date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        map.set(key, (map.get(key) ?? 0) + Math.max(0, Number(o.amount_due) - Number(o.amount_paid)));
      });
    return [...map.entries()].map(([k, total]) => {
      const [y, m] = k.split("-").map(Number);
      return { date: new Date(y, m, 1), total };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data.occurrences]);

  const openPay = (occ: PaymentOccurrence) => {
    const debt = occ.debt_id ? debtById.get(occ.debt_id) : null;
    if (debt) setPayTarget({ debt, occ });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <View style={styles.toggle}>
        <Pressable onPress={() => setTab("month")} style={[styles.seg, tab === "month" && styles.segActive]}>
          <Text style={[styles.segText, tab === "month" && { color: colors.ink }]}>Bu ay</Text>
        </Pressable>
        <Pressable onPress={() => setTab("future")} style={[styles.seg, tab === "future" && styles.segActive]}>
          <Text style={[styles.segText, tab === "future" && { color: colors.ink }]}>Gelecek aylar</Text>
        </Pressable>
      </View>

      {tab === "month" ? (
        <Card>
          {thisMonth.length === 0 ? (
            <Text style={{ color: colors.muted }}>Bu ay ödeme yok.</Text>
          ) : (
            thisMonth.map((o) => (
              <OccurrenceRow
                key={o.id}
                occ={o}
                personName={o.owner_type === "household" ? "Ortak" : personName.get(o.person_id ?? "") ?? "—"}
                onPay={() => openPay(o)}
              />
            ))
          )}
        </Card>
      ) : (
        <Card>
          {futureMonths.length === 0 ? (
            <Text style={{ color: colors.muted }}>Gelecek ay için planlı ödeme yok.</Text>
          ) : (
            futureMonths.map((m) => (
              <View key={m.date.toISOString()} style={styles.row}>
                <Text style={{ color: colors.ink }}>{TR_MONTHS[m.date.getMonth()]} {m.date.getFullYear()}</Text>
                <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(m.total)}</Text>
              </View>
            ))
          )}
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

const styles = {
  toggle: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: "center" as const },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
};
