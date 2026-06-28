import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { reversePayment } from "@/lib/occurrences";
import { track } from "@/lib/analytics";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { Debt, Payment, PaymentOccurrence } from "@/lib/database.types";

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const data = useHousehold();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);

  const person = data.persons.find((p) => p.id === id) ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({ title: person?.display_name ?? "Kişi" });
  }, [navigation, person]);

  const mine = useCallback(
    (r: { owner_type: string; person_id: string | null }) => r.owner_type === "person" && r.person_id === id,
    [id]
  );

  const debts = data.debts.filter(mine);
  const assets = data.assetViews.filter((v) => mine(v.asset));
  const occ = data.occurrences.filter(mine);
  const totalDebt = debts.reduce((s, d) => s + data.debtOutstanding(d), 0);
  const totalAsset = assets.reduce((s, v) => s + v.valueTRY, 0);

  const loadPayments = useCallback(async () => {
    const debtIds = debts.map((d) => d.id);
    if (debtIds.length === 0) { setPayments([]); return; }
    const { data: pays } = await supabase
      .from("payments").select("*").in("debt_id", debtIds).order("paid_at", { ascending: false }).limit(20);
    setPayments(pays ?? []);
  }, [debts.map((d) => d.id).join(",")]);
  useEffect(() => { loadPayments(); track("person_detail_opened"); }, [loadPayments]);
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const undo = (p: Payment) => {
    const debt = data.debts.find((d) => d.id === p.debt_id);
    if (!debt) return;
    Alert.alert("Ödemeyi geri al", `${formatTRY(Number(p.amount))} ödeme geri alınsın mı?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Geri al",
        style: "destructive",
        onPress: async () => {
          try {
            await reversePayment(p, debt);
            track("payment_reversed");
            data.reload();
            loadPayments();
          } catch {
            Alert.alert("Olmadı", "Ödeme geri alınamadı. Lütfen tekrar dene.");
          }
        },
      },
    ]);
  };

  const debtById = useMemo(() => {
    const m = new Map<string, Debt>();
    data.debts.forEach((d) => m.set(d.id, d));
    return m;
  }, [data.debts]);
  const openPay = (o: PaymentOccurrence) => {
    const debt = o.debt_id ? debtById.get(o.debt_id) : null;
    if (debt) setPayTarget({ debt, occ: o });
  };
  const q = `?person=${id}`;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={{ color: colors.inkSoft }}>Net durum</Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: totalAsset - totalDebt < 0 ? colors.danger : colors.ink }}>
          {formatTRY(totalAsset - totalDebt)}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
          <Text style={{ color: colors.debt, fontWeight: "700" }}>Borç {formatTRY(totalDebt)}</Text>
          <Text style={{ color: colors.asset, fontWeight: "700" }}>Varlık {formatTRY(totalAsset)}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.h}>Yaklaşan ödemeler</Text>
        {occ.filter((o) => o.status !== "paid" && o.status !== "skipped").length === 0 ? (
          <Text style={{ color: colors.muted }}>Yaklaşan ödeme yok.</Text>
        ) : (
          occ.filter((o) => o.status !== "paid" && o.status !== "skipped")
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
            .map((o) => <OccurrenceRow key={o.id} occ={o} onPay={() => openPay(o)} />)
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Borçlar</Text>
        {debts.length === 0 ? <Text style={{ color: colors.muted }}>Borç yok.</Text> : debts.map((d) => (
          <Link key={d.id} href={{ pathname: "/debt/[id]", params: { id: d.id } }} style={styles.line}>
            <Text style={{ color: colors.ink }}>{d.label ?? d.bank_name ?? d.bank} </Text>
            <Text style={{ color: colors.debt, fontWeight: "700" }}>{formatTRY(data.debtOutstanding(d))}</Text>
          </Link>
        ))}
      </Card>

      <Card>
        <Text style={styles.h}>Varlıklar</Text>
        {assets.length === 0 ? <Text style={{ color: colors.muted }}>Varlık yok.</Text> : assets.map((v) => (
          <View key={v.asset.id} style={styles.line}>
            <Text style={{ color: colors.ink }}>{v.asset.label}</Text>
            <Text style={{ color: colors.asset, fontWeight: "700" }}>{formatTRY(v.valueTRY)}</Text>
          </View>
        ))}
      </Card>

      {payments.length > 0 && (
        <Card>
          <Text style={styles.h}>Ödeme geçmişi</Text>
          {payments.map((p) => (
            <View key={p.id} style={styles.line}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{p.paid_at}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ color: p.is_reversed ? colors.muted : colors.ink, fontWeight: "600", textDecorationLine: p.is_reversed ? "line-through" : "none" }}>
                  {formatTRY(Number(p.amount))}
                </Text>
                {!p.is_reversed && (
                  <Pressable onPress={() => undo(p)}><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Geri al</Text></Pressable>
                )}
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.h}>Bu kişi için ekle</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <View style={{ flexGrow: 1, minWidth: "47%" }}><Button title="+ Borç" onPress={() => router.push(`/add-debt${q}`)} /></View>
          <View style={{ flexGrow: 1, minWidth: "47%" }}><Button title="+ Varlık" variant="ghost" onPress={() => router.push(`/add-asset${q}`)} /></View>
          <View style={{ flexGrow: 1, minWidth: "47%" }}><Button title="+ Gelir" variant="ghost" onPress={() => router.push(`/add-cashflow?direction=income&person=${id}`)} /></View>
          <View style={{ flexGrow: 1, minWidth: "47%" }}><Button title="+ Gider" variant="ghost" onPress={() => router.push(`/add-cashflow?direction=expense&person=${id}`)} /></View>
        </View>
      </Card>

      <PaymentModal
        visible={payTarget != null}
        householdId={(payTarget && payTarget.debt.household_id) ?? ""}
        debt={payTarget?.debt ?? null}
        occurrence={payTarget?.occ ?? null}
        onClose={() => setPayTarget(null)}
        onSaved={() => { data.reload(); loadPayments(); }}
      />
    </ScrollView>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  line: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(0.75), borderTopWidth: 1, borderTopColor: colors.line },
};
