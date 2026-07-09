import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { OccurrenceRow } from "@/components/OccurrenceRow";
import { PaymentModal } from "@/components/PaymentModal";
import { effectiveStatus } from "@/core/paymentOccurrences";
import { track } from "@/lib/analytics";
import { colors, spacing, typography } from "@/theme";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";

// "Ekle > Ödeme gir" — gerçek ödeme seçme akışı. Açık (bekleyen/kısmi/gecikmiş)
// ödemeleri listeler; birine dokununca PaymentModal açılır.
export default function Pay() {
  const router = useRouter();
  const data = useHousehold();
  const [payTarget, setPayTarget] = useState<{ debt: Debt; occ: PaymentOccurrence } | null>(null);

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

  const openPay = (occ: PaymentOccurrence) => {
    const debt = occ.debt_id ? debtById.get(occ.debt_id) : null;
    if (debt) setPayTarget({ debt, occ });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      {open.length === 0 ? (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink }]}>Ödenecek kayıt bulunamadı.</Text>
          <Text style={{ color: colors.inkSoft, marginTop: spacing(1), marginBottom: spacing(1.5) }}>
            Önce bir borç veya ödeme ekleyebilirsin.
          </Text>
          <Button title="Borç ekle" variant="neutral" onPress={() => router.push("/add-debt")} />
        </Card>
      ) : (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink, marginBottom: spacing(0.5) }]}>
            Hangi ödemeyi gireceksin?
          </Text>
          {open.map((o) => (
            <OccurrenceRow key={o.id} occ={o} personName={nameFor(o)} onPay={() => openPay(o)} />
          ))}
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
