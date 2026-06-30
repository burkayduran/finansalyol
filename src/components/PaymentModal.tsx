// Ödeme gir modalı. Bir occurrence ya da borç için ödeme yazar.
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { Button, Field } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { recordPayment } from "@/lib/occurrences";
import { track } from "@/lib/analytics";
import { debtInstallment } from "@/core/paymentOccurrences";
import type { Debt, PaymentOccurrence } from "@/lib/database.types";
import { colors, spacing } from "@/theme";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.getDate() === Number(dd) ? d : null;
}

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
  const [dateStr, setDateStr] = useState(todayStr());
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
    const d = parseDate(dateStr);
    if (!d) return Alert.alert("Eksik", "Tarihi GG.AA.YYYY gir.");
    setSaving(true);
    try {
      await recordPayment({
        householdId, debt, occurrence: occurrence ?? null,
        amount: amt, paidAt: d.toISOString().slice(0, 10), note,
      });
      track("payment_recorded", {
        payment_type: amt >= fullAmount ? "full" : "partial",
        occurrence_status_before: occurrence?.status,
      });
      setAmount(""); setNote(""); setDateStr(todayStr());
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
              <Quick label={`Tamamı ${formatTRY(fullAmount)}`} onPress={() => setAmount(String(Math.round(fullAmount)))} />
            )}
            {installmentAmount > 0 && (
              <Quick label={`Taksit ${formatTRY(installmentAmount)}`} onPress={() => setAmount(String(Math.round(installmentAmount)))} />
            )}
          </View>

          <Field label="Ödenen tutar" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="örn. 8.750" />
          <Field label="Tarih" value={dateStr} onChangeText={setDateStr} placeholder="GG.AA.YYYY" />
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
