import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

export default function HouseholdDetail() {
  const data = useHousehold();
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const mine = (r: { owner_type: string }) => r.owner_type === "household";
  const debts = data.debts.filter(mine);
  const assets = data.assetViews.filter((v) => mine(v.asset));
  const occ = data.occurrences.filter(mine).filter((o) => o.status !== "paid" && o.status !== "skipped");
  const totalDebt = debts.reduce((s, d) => s + data.debtOutstanding(d), 0);
  const totalAsset = assets.reduce((s, v) => s + v.valueTRY, 0);

  const debtById = useMemo(() => {
    const m = new Map<string, Debt>();
    data.debts.forEach((d) => m.set(d.id, d));
    return m;
  }, [data.debts]);
  const openPay = (o: PaymentOccurrence) => {
    const debt = o.debt_id ? debtById.get(o.debt_id) : null;
    if (debt) setPayTarget({ debt, occ: o });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={{ color: colors.inkSoft }}>Net durum</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: totalAsset - totalDebt < 0 ? colors.danger : colors.asset }} />
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink }}>
            {formatTRY(totalAsset - totalDebt)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
          <Text style={{ color: colors.debt, fontWeight: "700" }}>Borç {formatTRY(totalDebt)}</Text>
          <Text style={{ color: colors.asset, fontWeight: "700" }}>Varlık {formatTRY(totalAsset)}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.h}>Yaklaşan ödemeler</Text>
        {occ.length === 0 ? (
          <Text style={{ color: colors.muted }}>Yaklaşan ödeme yok.</Text>
        ) : (
          occ.sort((a, b) => a.due_date.localeCompare(b.due_date)).map((o) => (
            <OccurrenceRow key={o.id} occ={o} onPay={() => openPay(o)} />
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Ortak borçlar</Text>
        {debts.length === 0 ? <Text style={{ color: colors.muted }}>Yok.</Text> : debts.map((d) => (
          <Link key={d.id} href={{ pathname: "/debt/[id]", params: { id: d.id } }} style={styles.line}>
            <Text style={{ color: colors.ink }}>{d.label ?? d.bank_name ?? d.bank} </Text>
            <Text style={{ color: colors.debt, fontWeight: "700" }}>{formatTRY(data.debtOutstanding(d))}</Text>
          </Link>
        ))}
      </Card>

      <Card>
        <Text style={styles.h}>Ortak varlıklar</Text>
        {assets.length === 0 ? <Text style={{ color: colors.muted }}>Yok.</Text> : assets.map((v) => (
          <View key={v.asset.id} style={styles.line}>
            <Text style={{ color: colors.ink }}>{v.asset.label}</Text>
            <Text style={{ color: colors.asset, fontWeight: "700" }}>{formatTRY(v.valueTRY)}</Text>
          </View>
        ))}
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
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  line: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(0.75), borderTopWidth: 1, borderTopColor: colors.line },
};
