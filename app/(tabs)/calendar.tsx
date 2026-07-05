import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card, NavRow } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { UpcomingBars, type WeekBar } from "@/components/charts";
import { track } from "@/lib/analytics";
import { formatTRY } from "@/core/format";
import { parseISODateLocal, toISODateLocal } from "@/core/dates";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/theme";
import type { Debt, PaymentOccurrence, PaymentOccurrenceStatus } from "@/lib/database.types";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const FILTERS: { key: "all" | "pending" | "paid" | "overdue"; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Bekleyen" },
  { key: "paid", label: "Ödendi" },
  { key: "overdue", label: "Geciken" },
];

export default function Calendar() {
  const data = useHousehold();
  const router = useRouter();
  const [tab, setTab] = useState<"month" | "future">("month");
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);
  useFocusEffect(useCallback(() => { data.reload(); track("calendar_opened"); }, [data.reload]));

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

  const now = new Date();
  const todayISO = toISODateLocal(now);
  const ms = new Date(now.getFullYear(), now.getMonth(), 1);
  const me = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthAll = data.occurrences.filter((o) => {
    const d = parseISODateLocal(o.due_date);
    return d >= ms && d <= me;
  });

  // Ay özeti
  const monthTotal = monthAll.filter((o) => o.status !== "skipped").reduce((s, o) => s + Number(o.amount_due), 0);
  const monthPaid = monthAll.reduce((s, o) => s + Number(o.amount_paid), 0);
  const monthPending = monthAll
    .filter((o) => o.status === "pending" || o.status === "partial")
    .reduce((s, o) => s + Math.max(0, Number(o.amount_due) - Number(o.amount_paid)), 0);
  const monthOverdue = monthAll
    .filter((o) => o.status === "overdue")
    .reduce((s, o) => s + Math.max(0, Number(o.amount_due) - Number(o.amount_paid)), 0);

  // Bu ay — haftalık yığın (1-7, 8-14, 15-21, 22-31)
  const weekBars: WeekBar[] = useMemo(() => {
    const buckets: WeekBar[] = [
      { label: "1–7", paid: 0, pending: 0, overdue: 0 },
      { label: "8–14", paid: 0, pending: 0, overdue: 0 },
      { label: "15–21", paid: 0, pending: 0, overdue: 0 },
      { label: "22–31", paid: 0, pending: 0, overdue: 0 },
    ];
    monthAll.forEach((o) => {
      if (o.status === "skipped") return;
      const day = parseISODateLocal(o.due_date).getDate();
      const b = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      const paidAmt = Number(o.amount_paid);
      const remaining = Math.max(0, Number(o.amount_due) - paidAmt);
      if (paidAmt > 0) buckets[b].paid += paidAmt;
      if (o.status === "overdue") buckets[b].overdue += remaining;
      else if (o.status === "pending" || o.status === "partial") buckets[b].pending += remaining;
    });
    return buckets;
  }, [data.occurrences]);

  const matchFilter = (o: PaymentOccurrence) => {
    if (filter === "all") return true;
    if (filter === "pending") return o.status === "pending" || o.status === "partial";
    if (filter === "paid") return o.status === "paid";
    if (filter === "overdue") return o.status === "overdue";
    return true;
  };

  // Gün bazlı gruplama
  const byDay = useMemo(() => {
    const map = new Map<string, PaymentOccurrence[]>();
    monthAll.filter(matchFilter).sort((a, b) => a.due_date.localeCompare(b.due_date)).forEach((o) => {
      (map.get(o.due_date) ?? map.set(o.due_date, []).get(o.due_date)!).push(o);
    });
    return [...map.entries()];
  }, [data.occurrences, filter]);

  const futureMonths = useMemo(() => {
    const map = new Map<string, PaymentOccurrence[]>();
    data.occurrences
      .filter((o) => o.status !== "skipped")
      .filter((o) => parseISODateLocal(o.due_date) > me)
      .forEach((o) => {
        const d = parseISODateLocal(o.due_date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        (map.get(key) ?? map.set(key, []).get(key)!).push(o);
      });
    return [...map.entries()]
      .map(([k, list]) => {
        const [y, m] = k.split("-").map(Number);
        return { key: k, date: new Date(y, m, 1), list: list.sort((a, b) => a.due_date.localeCompare(b.due_date)),
          total: list.reduce((s, o) => s + Math.max(0, Number(o.amount_due) - Number(o.amount_paid)), 0) };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
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
        <>
          <Card>
            <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>
              {TR_MONTHS[now.getMonth()]} özeti
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing(1) }}>
              <Summary label="Toplam" value={formatTRY(monthTotal)} color={colors.ink} />
              <Summary label="Ödenen" value={formatTRY(monthPaid)} color={colors.asset} />
              <Summary label="Bekleyen" value={formatTRY(monthPending)} color={colors.ink} />
              <Summary label="Geciken" value={formatTRY(monthOverdue)} color={monthOverdue > 0 ? colors.danger : colors.muted} />
            </View>
          </Card>

          {monthAll.length > 0 && (
            <Card>
              <UpcomingBars weeks={weekBars} />
            </Card>
          )}

          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f.key && { color: colors.ink }]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          {byDay.length === 0 ? (
            <Card><Text style={{ color: colors.muted }}>Bu filtrede ödeme yok.</Text></Card>
          ) : (
            byDay.map(([day, list]) => {
              const isToday = day === todayISO;
              return (
              <Card key={day}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <Text style={[styles.dayHeader, isToday && { marginBottom: 0 }]}>
                    {parseISODateLocal(day).getDate()} {TR_MONTHS[parseISODateLocal(day).getMonth()]}
                  </Text>
                  {isToday && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Bugün</Text>
                    </View>
                  )}
                </View>
                {list.map((o) => (
                  <OccurrenceRow key={o.id} occ={o} personName={nameFor(o)} onPay={() => openPay(o)} />
                ))}
              </Card>
              );
            })
          )}
        </>
      ) : (
        <>
          {futureMonths.length === 0 ? (
            <Card><Text style={{ color: colors.muted }}>Gelecek ay için planlı ödeme yok.</Text></Card>
          ) : (
            futureMonths.map((m) => (
              <Card key={m.key}>
                <Pressable onPress={() => setOpenMonth(openMonth === m.key ? null : m.key)} style={styles.row}>
                  <View>
                    <Text style={{ color: colors.ink, fontWeight: "700" }}>{TR_MONTHS[m.date.getMonth()]} {m.date.getFullYear()}</Text>
                    <Text style={{ color: colors.inkSoft, fontSize: 13 }}>{m.list.length} ödeme</Text>
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(m.total)}</Text>
                </Pressable>
                {openMonth === m.key &&
                  m.list.map((o) => (
                    <OccurrenceRow key={o.id} occ={o} personName={nameFor(o)} onPay={() => openPay(o)} />
                  ))}
              </Card>
            ))
          )}
          <Card>
            <NavRow title="Nakit akışı detayı →" onPress={() => router.push("/cashflow")} />
          </Card>
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

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: 4 }}>
      <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const styles = {
  toggle: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: "center" as const },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
  filters: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1) },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
  dayHeader: { fontWeight: "800" as const, color: colors.ink, marginBottom: 2 },
  todayBadge: { borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { color: colors.accent, fontSize: 11, fontWeight: "700" as const },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
};
