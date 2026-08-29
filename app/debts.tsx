import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { getMandatoryAmountForDebt, type DebtForOcc } from "@/core/paymentOccurrences";
import { colors, spacing, typography } from "@/theme";
import type { Debt, DebtKind } from "@/lib/database.types";

const KIND_LABELS: Record<DebtKind, string> = {
  credit_card: "Kredi kartı",
  kmh: "KMH",
  installment_kmh: "Taksitli KMH",
  loan: "Kredi",
};
const FILTERS: { key: "all" | DebtKind; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "credit_card", label: "Kredi kartı" },
  { key: "kmh", label: "KMH" },
  { key: "installment_kmh", label: "Taksitli KMH" },
  { key: "loan", label: "Kredi" },
];

export default function Debts() {
  const router = useRouter();
  const data = useHousehold();
  const [filter, setFilter] = useState<"all" | DebtKind>("all");
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const out = data.debtOutstanding;
  const activeDebts = data.debts.filter((d) => d.is_active !== false);

  const byBank = useMemo(() => {
    const m = new Map<string, number>();
    activeDebts.forEach((d) => {
      const name = d.bank_name ?? d.bank ?? "Diğer";
      m.set(name, (m.get(name) ?? 0) + out(d));
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.debts]);

  const byKind = useMemo(() => {
    const m = new Map<DebtKind, number>();
    activeDebts.forEach((d) => m.set(d.kind, (m.get(d.kind) ?? 0) + out(d)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.debts]);

  const list = activeDebts.filter((d) => filter === "all" || d.kind === filter);
  const personName = (d: Debt) =>
    d.owner_type === "household" ? "Ortak" : data.persons.find((p) => p.id === d.person_id)?.display_name ?? "—";

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={[typography.label, { color: colors.inkSoft }]}>Toplam borç</Text>
        <Text style={[typography.statAmount, { color: colors.debt }]}>{formatTRY(data.totalDebt)}</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13 }}>{activeDebts.length} aktif borç</Text>
      </Card>

      {data.personCards.some((c) => c.totalDebt > 0) && (
        <Card>
          <Text style={styles.h}>Kişiye göre</Text>
          {data.personCards.filter((c) => c.totalDebt > 0).map((c) => (
            <Line key={c.key} label={c.name} value={c.totalDebt} />
          ))}
        </Card>
      )}

      {byBank.length > 0 && (
        <Card>
          <Text style={styles.h}>Bankaya göre</Text>
          {byBank.map(([name, val]) => <Line key={name} label={name} value={val} />)}
        </Card>
      )}

      {byKind.length > 0 && (
        <Card>
          <Text style={styles.h}>Türe göre</Text>
          {byKind.map(([k, val]) => <Line key={k} label={KIND_LABELS[k]} value={val} />)}
        </Card>
      )}

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.key && { color: colors.ink }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={styles.h}>Aktif borçlar</Text>
        {list.length === 0 ? (
          <View>
            <Text style={{ color: colors.muted, marginBottom: spacing(1) }}>
              {activeDebts.length === 0
                ? "Henüz borç eklenmedi. Kredi kartı, KMH veya kredi ekleyerek ödeme günlerini takip et."
                : "Bu filtrede borç yok."}
            </Text>
            <Pressable onPress={() => router.push("/add-debt")}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Borç ekle</Text>
            </Pressable>
          </View>
        ) : (
          list.map((d) => {
            const min = getMandatoryAmountForDebt(d as DebtForOcc);
            return (
              <Link key={d.id} href={{ pathname: "/debt/[id]", params: { id: d.id } }} asChild>
                <Pressable style={styles.debtRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: "600" }}>
                      {d.bank_name ?? d.bank}{d.label ? ` · ${d.label}` : ""}
                    </Text>
                    <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                      {personName(d)} · {KIND_LABELS[d.kind]}
                    </Text>
                    {min > 0 && (
                      <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Bu ay min.: {formatTRY(min)}</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(out(d))}</Text>
                </Pressable>
              </Link>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.line}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(value)}</Text>
    </View>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  line: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: spacing(0.75), borderTopWidth: 1, borderTopColor: colors.line },
  debtRow: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line },
  filters: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: spacing(1) },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
};
