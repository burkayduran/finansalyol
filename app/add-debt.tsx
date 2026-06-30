import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { BankSelect, Button, Card, Field, type BankValue } from "@/components/ui";
import { OwnerSelect, type OwnerValue } from "@/components/OwnerSelect";
import { parseTRYInput, formatTRY } from "@/core/format";
import { track } from "@/lib/analytics";
import { ensureHousehold, handleSaveError } from "@/lib/errors";
import { colors, spacing } from "@/theme";
import type { DebtKind } from "@/lib/database.types";

const SEGMENTS: { key: DebtKind; label: string }[] = [
  { key: "credit_card", label: "Kredi kartı" },
  { key: "kmh", label: "KMH" },
  { key: "installment_kmh", label: "Taksitli KMH" },
  { key: "loan", label: "Kredi" },
];
const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.getDate() === Number(dd) ? d : null;
}

export default function AddDebt() {
  const router = useRouter();
  const navigation = useNavigation();
  const { householdId } = useSession();
  const params = useLocalSearchParams<{ person?: string; id?: string }>();
  const editId = params.id;

  const [owner, setOwner] = useState<OwnerValue>(
    params.person ? { ownerType: "person", personId: params.person } : { ownerType: "person", personId: null }
  );
  const [kind, setKind] = useState<DebtKind>("credit_card");
  const [bank, setBank] = useState<BankValue>({ code: "", name: "" });
  const [label, setLabel] = useState("");
  const [balance, setBalance] = useState(""); // dönem borcu / kullanılan / güncel kalan
  const [cardLimit, setCardLimit] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [userMin, setUserMin] = useState("");
  const [rate, setRate] = useState("");
  const [installment, setInstallment] = useState("");
  const [remaining, setRemaining] = useState("");
  const [totalCount, setTotalCount] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isInstallment = kind === "loan" || kind === "installment_kmh";

  useLayoutEffect(() => {
    if (editId) navigation.setOptions({ title: "Borcu düzenle" });
  }, [navigation, editId]);

  useEffect(() => {
    if (!editId) return;
    supabase.from("debts").select("*").eq("id", editId).maybeSingle().then(({ data: d }) => {
      if (!d) return;
      setOwner({ ownerType: d.owner_type, personId: d.person_id });
      setKind(d.kind);
      setBank({ code: d.bank_code ?? "", name: d.bank_name ?? d.bank ?? "" });
      setLabel(d.label ?? "");
      setNote(d.note ?? "");
      setRate(d.user_monthly_rate != null ? String(d.user_monthly_rate) : "");
      const bal = d.current_balance ?? d.balance;
      setBalance(bal != null ? String(bal) : "");
      setCardLimit(d.card_limit != null ? String(d.card_limit) : "");
      setDueDay(d.due_day != null ? String(d.due_day) : "");
      setStatementDay(d.statement_day != null ? String(d.statement_day) : "");
      setUserMin(d.user_minimum_payment != null ? String(d.user_minimum_payment) : "");
      setInstallment(d.monthly_installment != null ? String(d.monthly_installment) : d.installment != null ? String(d.installment) : "");
      setRemaining(d.remaining_installment_count != null ? String(d.remaining_installment_count) : "");
      setTotalCount(d.total_installment_count != null ? String(d.total_installment_count) : "");
      const nd = d.next_due_date ?? d.first_installment_date;
      if (nd) {
        const x = new Date(nd);
        setNextDue(`${String(x.getDate()).padStart(2, "0")}.${String(x.getMonth() + 1).padStart(2, "0")}.${x.getFullYear()}`);
      }
    });
  }, [editId]);

  const removeItem = () =>
    Alert.alert("Borcu sil", "Bu borç ve ödemeleri silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { await supabase.from("debts").delete().eq("id", editId!); router.back(); } },
    ]);

  const summary = useMemo(() => {
    if (!isInstallment) return null;
    const inst = parseTRYInput(installment);
    const rem = Number(remaining);
    const nd = parseDate(nextDue);
    if (!inst || !Number.isInteger(rem) || rem <= 0 || !nd) return null;
    const end = new Date(nd);
    end.setMonth(end.getMonth() + rem - 1);
    return { outstanding: inst * rem, end };
  }, [isInstallment, installment, remaining, nextDue]);

  const ownerValid = owner.ownerType === "household" || owner.personId != null;

  const save = async () => {
    if (!ensureHousehold(householdId)) return;
    if (!ownerValid) return Alert.alert("Eksik", "Kime ait olduğunu seç.");
    if (!bank.name.trim()) return Alert.alert("Eksik", "Banka seç.");

    const base: Record<string, unknown> = {
      household_id: householdId!,
      owner_type: owner.ownerType,
      person_id: owner.ownerType === "person" ? owner.personId : null,
      kind,
      bank: bank.name.trim(),
      bank_code: bank.code || null,
      bank_name: bank.name.trim(),
      label: label.trim() || null,
      note: note.trim() || null,
      user_monthly_rate: parseTRYInput(rate),
      is_active: true,
      reminder_enabled: true,
      currency: "TRY",
    };

    if (isInstallment) {
      const bal = parseTRYInput(balance);
      const inst = parseTRYInput(installment);
      const rem = Number(remaining);
      const nd = parseDate(nextDue);
      if (bal == null || bal < 0) return Alert.alert("Eksik", "Güncel kalan borcu gir.");
      if (inst == null || inst <= 0) return Alert.alert("Eksik", "Aylık taksiti gir.");
      if (!Number.isInteger(rem) || rem <= 0) return Alert.alert("Eksik", "Kalan taksit sayısını gir.");
      if (!nd) return Alert.alert("Eksik", "Sıradaki taksit tarihini GG.AA.YYYY gir.");
      Object.assign(base, {
        balance: bal, current_balance: bal,
        monthly_installment: inst, installment: inst,
        remaining_installment_count: rem,
        total_installment_count: totalCount ? Number(totalCount) : rem,
        next_due_date: nd.toISOString().slice(0, 10),
        due_day: nd.getDate(),
      });
    } else if (kind === "credit_card") {
      const bal = parseTRYInput(balance);
      const due = Number(dueDay);
      if (bal == null || bal <= 0) return Alert.alert("Eksik", "Dönem borcunu gir.");
      if (!Number.isInteger(due) || due < 1 || due > 31) return Alert.alert("Eksik", "Son ödeme gününü 1–31 gir.");
      Object.assign(base, {
        balance: bal, current_balance: bal,
        card_limit: parseTRYInput(cardLimit),
        due_day: due,
        statement_day: statementDay ? Number(statementDay) : null,
        user_minimum_payment: parseTRYInput(userMin),
      });
    } else {
      // normal KMH
      const bal = parseTRYInput(balance);
      if (bal == null || bal <= 0) return Alert.alert("Eksik", "Kullanılan KMH tutarını gir.");
      const due = Number(dueDay);
      Object.assign(base, {
        balance: bal, current_balance: bal,
        due_day: Number.isInteger(due) && due >= 1 && due <= 31 ? due : 1,
        user_minimum_payment: parseTRYInput(userMin),
      });
    }

    setSaving(true);
    const { error } = editId
      ? await supabase.from("debts").update(base as never).eq("id", editId)
      : await supabase.from("debts").insert(base as never);
    setSaving(false);
    if (handleSaveError("add-debt", error, "Borç kaydedilemedi. Lütfen tekrar dene.")) return;
    if (!editId) track("debt_added", { debt_kind: kind, owner_type: owner.ownerType, has_bank_code: !!bank.code });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <OwnerSelect value={owner} onChange={setOwner} />

        <Text style={styles.label}>Borç türü</Text>
        <View style={styles.segment}>
          {SEGMENTS.map((s) => (
            <Pressable key={s.key} onPress={() => setKind(s.key)} style={[styles.seg, kind === s.key && styles.segActive]}>
              <Text style={[styles.segText, kind === s.key && { color: colors.ink }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <BankSelect label="Banka" value={bank} onChange={setBank} />
        <Field label="Etiket" value={label} onChangeText={setLabel} placeholder="örn. Market kartı" />

        {kind === "credit_card" && (
          <>
            <Field label="Dönem borcu" value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="örn. 28.400" />
            <Field label="Kart limiti" value={cardLimit} onChangeText={setCardLimit} keyboardType="numeric" placeholder="örn. 90.000" hint="Asgari ödeme tahmini için kullanılır." />
            <Field label="Son ödeme günü" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" placeholder="1–31" />
            <Field label="Ekstre kesim günü (ops.)" value={statementDay} onChangeText={setStatementDay} keyboardType="numeric" placeholder="ops." />
            <Field label="Kullanıcı minimum ödeme (ops.)" value={userMin} onChangeText={setUserMin} keyboardType="numeric" placeholder="ops." />
            <Field label="Kullanıcı faiz oranı % (ops.)" value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="ops." />
          </>
        )}

        {isInstallment && (
          <>
            <Field label="Güncel kalan borç" value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="örn. 64.000" />
            <Field label="Aylık taksit" value={installment} onChangeText={setInstallment} keyboardType="numeric" placeholder="örn. 8.750" />
            <Field label="Kalan taksit sayısı" value={remaining} onChangeText={setRemaining} keyboardType="numeric" placeholder="örn. 8" />
            <Field label="Sıradaki taksit tarihi" value={nextDue} onChangeText={setNextDue} placeholder="GG.AA.YYYY" />
            <Field label="Toplam taksit sayısı (ops.)" value={totalCount} onChangeText={setTotalCount} keyboardType="numeric" placeholder="ops." />
            {summary && (
              <View style={styles.summaryBox}>
                <Text style={{ color: colors.ink, fontWeight: "600" }}>≈ {formatTRY(summary.outstanding)} kalan</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Bitiş: {TR_MONTHS[summary.end.getMonth()]} {summary.end.getFullYear()}
                </Text>
              </View>
            )}
          </>
        )}

        {kind === "kmh" && (
          <>
            <Field label="Kullanılan KMH tutarı" value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="örn. 22.000" />
            <Field label="Kontrol/son ödeme günü (ops.)" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" placeholder="ops." />
            <Field label="Kullanıcı minimum ödeme (ops.)" value={userMin} onChangeText={setUserMin} keyboardType="numeric" placeholder="ops." />
            <Field label="Faiz oranı % (ops.)" value={rate} onChangeText={setRate} keyboardType="numeric" placeholder="ops." />
          </>
        )}

        <Field label="Not (ops.)" value={note} onChangeText={setNote} placeholder="" />
      </Card>

      <Button title="Kaydet" onPress={save} loading={saving} />
      {editId && <Button title="Borcu sil" variant="link" onPress={removeItem} />}
    </ScrollView>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  segment: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
  summaryBox: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: spacing(1.5), marginBottom: spacing(1) },
};
