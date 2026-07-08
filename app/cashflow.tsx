import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { CashflowChartWrap } from "@/components/analytics";
import { mandatoryMinimum } from "@/core/minimum";
import { projectCashflow, type CashflowDebt, type CashflowEntry } from "@/core/cashflow";
import { formatTRY } from "@/core/format";
import { parseISODateLocal } from "@/core/dates";
import { colors, spacing } from "@/theme";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export default function Cashflow() {
  const router = useRouter();
  const data = useHousehold();

  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const rows = useMemo(() => {
    const entries: CashflowEntry[] = data.cashFlows.map((c) => ({
      amount: Number(c.amount) * data.fxRateFor(c.currency),
      direction: c.direction,
      recurrence: c.recurrence,
      occurredOn: c.occurred_on ? parseISODateLocal(c.occurred_on) : undefined,
    }));
    const debts: CashflowDebt[] = data.debts.map((d) => ({
      kind: d.kind,
      monthlyMinimum: mandatoryMinimum({
        kind: d.kind,
        balance: data.debtOutstanding(d),
        cardLimit: d.card_limit,
        installment: d.monthly_installment ?? d.installment,
        userMinimum: d.user_minimum_payment ?? d.user_minimum,
      }),
      installment: (d.monthly_installment ?? d.installment) ?? undefined,
      termCount: (d.remaining_installment_count ?? d.term_count) ?? undefined,
      firstInstallmentDate: d.next_due_date ? parseISODateLocal(d.next_due_date) : d.first_installment_date ? parseISODateLocal(d.first_installment_date) : undefined,
    }));
    return projectCashflow(entries, debts, 12);
  }, [data.cashFlows, data.debts, data.fxRateFor, data.debtOutstanding]);

  const hasData = data.cashFlows.length > 0 || data.debts.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Bu ay net</Text>
        <Text
          style={{
            fontSize: 30,
            fontWeight: "800",
            color: data.monthlyNet < 0 ? colors.danger : colors.ink,
          }}
        >
          {formatTRY(data.monthlyNet)}
        </Text>
      </Card>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing(1) }}>
        <View style={{ flex: 1 }}>
          <Button title="Gelir ekle" variant="neutral" onPress={() => router.push("/add-cashflow?direction=income")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Gider ekle" variant="neutral" onPress={() => router.push("/add-cashflow?direction=expense")} />
        </View>
      </View>

      {hasData && <CashflowChartWrap projection={data.projection} />}

      {hasData && (
        <Card>
          <Text style={styles.section}>Aylık detay</Text>
          <View style={styles.head}>
            <Text style={[styles.hcell, { flex: 1 }]}>Ay</Text>
            <Text style={[styles.hcell, styles.num]}>Gelir</Text>
            <Text style={[styles.hcell, styles.num]}>Gider+Borç</Text>
            <Text style={[styles.hcell, styles.num]}>Net</Text>
          </View>
          {rows.map((r) => (
            <View key={r.month.toISOString()} style={styles.row}>
              <Text style={[styles.cell, { flex: 1, color: colors.ink }]}>
                {TR_MONTHS[r.month.getMonth()]} {String(r.month.getFullYear()).slice(2)}
              </Text>
              <Text style={[styles.cell, styles.num, { color: colors.inkSoft }]}>{formatTRY(r.income)}</Text>
              <Text style={[styles.cell, styles.num, { color: colors.inkSoft }]}>
                {formatTRY(r.expense + r.debtDue)}
              </Text>
              <Text style={[styles.cell, styles.num, { color: r.net < 0 ? colors.danger : colors.ink, fontWeight: "700" }]}>
                {formatTRY(r.net)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {data.cashFlows.length > 0 && (
        <Card>
          <Text style={styles.section}>Kalemler</Text>
          {data.cashFlows.map((c) => (
            <Pressable key={c.id} style={styles.row} onPress={() => router.push(`/add-cashflow?id=${c.id}`)}>
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, marginRight: 8 }}>{c.label ?? c.category}</Text>
              <Text style={{ color: c.direction === "income" ? colors.asset : colors.debt, fontWeight: "700" }}>
                {c.direction === "income" ? "+" : "−"}
                {formatTRY(Number(c.amount))}
                {c.currency !== "TRY" ? ` ${c.currency}` : ""}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = {
  section: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  head: { flexDirection: "row" as const, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 6 },
  row: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  cell: { flex: 1, fontSize: 13 },
  hcell: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: "700" as const },
  num: { textAlign: "right" as const },
};
