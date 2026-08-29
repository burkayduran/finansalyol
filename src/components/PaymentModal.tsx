// Ödeme gir modalı. Bir occurrence ya da borç için ödeme yazar.
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { AmountField, Button, DateField, Field } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { toISODateLocal } from "@/core/dates";
import { recordPayment } from "@/lib/occurrences";
import { track } from "@/lib/analytics";
import { debtInstallment } from "@/core/paymentOccurrences";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";
import { colors, spacing } from "@/theme";

export function PaymentModal({
  visible,
  householdId,
  debt,
  occurrence,
  onClose,
  onSaved,
}: {
  visible: boolean;
  householdId: string;
  debt: Debt | null;
  occurrence?: PaymentOccurrence | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fullAmount = useMemo(() => {
    if (occurrence) return Math.max(0, Number(occurrence.amount_due) - Number(occurrence.amount_paid));
    if (debt) return Number(debt.current_balance ?? debt.balance);
    return 0;
  }, [occurrence, debt]);
  const installmentAmount = debt ? debtInstallment(debt) : 0;

  const save = async () => {
    if (!debt) return;
    if (!householdId) return Alert.alert("Hane bulunamadı", "Önce bir hane oluşturmalısın.");
    const amt = parseTRYInput(amount);
    if (amt == null || amt <= 0) return Alert.alert("Eksik", "Ödenen tutarı gir.");
    setSaving(true);
    try {
      await recordPayment({
        householdId, debt, occurrence: occurrence ?? null,
        amount: amt, paidAt: toISODateLocal(date), note,
      });
      track("payment_recorded", {
        payment_type: amt >= fullAmount ? "full" : "partial",
        occurrence_status_before: occurrence?.status,
      });
      setAmount(""); setNote(""); setDate(new Date());
      onSaved();
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[payment-modal] record error", e);
      const detail = (e as { message?: string })?.message;
      Alert.alert("Kaydedilemedi", typeof __DEV__ !== "undefined" && __DEV__ && detail ? `Ödeme kaydedilemedi.\n\n[dev] ${detail}` : "Ödeme kaydedilemedi. Lütfen tekrar dene.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Ödeme gir</Text>
          {debt && (
            <Text style={{ color: colors.inkSoft, marginBottom: spacing(1) }}>
              {debt.label ?? debt.bank_name ?? debt.bank}
            </Text>
          )}

          <View style={styles.quick}>
            {fullAmount > 0 && (
              <Quick label={`Tamamı ${formatTRY(fullAmount)}`} onPress={() => setAmount(Math.round(fullAmount).toLocaleString("tr-TR"))} />
            )}
            {installmentAmount > 0 && (
              <Quick label={`Taksit ${formatTRY(installmentAmount)}`} onPress={() => setAmount(Math.round(installmentAmount).toLocaleString("tr-TR"))} />
            )}
          </View>

          <AmountField label="Ödenen tutar" value={amount} onChangeText={setAmount} placeholder="örn. 8.750" />
          <DateField label="Tarih" value={date} onChange={setDate} />
          <Field label="Not (opsiyonel)" value={note} onChangeText={setNote} placeholder="" />

          <Button title="Kaydet" onPress={save} loading={saving} />
          <Button title="Vazgeç" variant="link" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Quick({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickChip}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" as const },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing(2.5),
  },
  title: { fontSize: 18, fontWeight: "800" as const, color: colors.ink, marginBottom: 4 },
  quick: { flexDirection: "row" as const, gap: 8, flexWrap: "wrap" as const, marginBottom: spacing(1) },
  quickChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft,
  },
};
