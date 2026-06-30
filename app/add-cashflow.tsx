import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field, Select } from "@/components/ui";
import { OwnerSelect, type OwnerValue } from "@/components/OwnerSelect";
import { parseTRYInput, formatTRY } from "@/core/format";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/core/currencies";
import { toTRY } from "@/core/fx";
import { track } from "@/lib/analytics";
import { ensureHousehold, handleSaveError } from "@/lib/errors";
import { useFxRates } from "@/hooks/useFxRates";
import { colors, spacing } from "@/theme";
import type { CashFlowDirection } from "@/lib/database.types";

const CATEGORIES: Record<CashFlowDirection, { value: string; label: string }[]> = {
  income: [
    { value: "salary", label: "Maaş" },
    { value: "rent", label: "Kira geliri" },
    { value: "dividend", label: "Faiz/temettü" },
    { value: "freelance", label: "Serbest/ek iş" },
    { value: "bonus", label: "Prim/ikramiye" },
    { value: "other", label: "Diğer" },
  ],
  expense: [
    { value: "rent", label: "Kira" },
    { value: "bill", label: "Fatura" },
    { value: "subscription", label: "Abonelik" },
    { value: "grocery", label: "Market" },
    { value: "education", label: "Eğitim" },
    { value: "transport", label: "Ulaşım" },
    { value: "health", label: "Sağlık" },
    { value: "other", label: "Diğer" },
  ],
};

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

// "GG.AA.YYYY" -> Date | null
function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.getDate() === Number(dd) ? d : null;
}
const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

export default function AddCashflow() {
  const router = useRouter();
  const navigation = useNavigation();
  const { householdId } = useSession();
  const fxRates = useFxRates();
  const params = useLocalSearchParams<{ direction?: string; person?: string; id?: string }>();
  const editId = params.id;
  // Yön butondan gelir; ekranda Tür seçici YOK. Yoksa income varsay.
  const [direction, setDirection] = useState<CashFlowDirection>(params.direction === "expense" ? "expense" : "income");

  const [owner, setOwner] = useState<OwnerValue>(
    params.person ? { ownerType: "person", personId: params.person } : { ownerType: "person", personId: null }
  );
  const [recurrence, setRecurrence] = useState<"monthly" | "one_time">("monthly");
  const [category, setCategory] = useState(CATEGORIES[direction][0].value);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [occurredOn, setOccurredOn] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editId ? "Kaydı düzenle" : direction === "income" ? "Gelir ekle" : "Gider ekle",
    });
  }, [navigation, direction, editId]);

  useEffect(() => {
    if (!editId) return;
    supabase.from("cash_flows").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setDirection(data.direction);
      setOwner({ ownerType: data.owner_type, personId: data.person_id });
      setRecurrence(data.recurrence);
      setCategory(data.category);
      setLabel(data.label ?? "");
      setAmount(String(data.amount));
      setCurrency(data.currency);
      if (data.occurred_on) {
        const d = new Date(data.occurred_on);
        setOccurredOn(`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`);
      }
    });
  }, [editId]);

  const removeItem = () =>
    Alert.alert("Kaydı sil", "Bu gelir/gider kaydı silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { await supabase.from("cash_flows").delete().eq("id", editId!); router.back(); } },
    ]);

  const preview = useMemo(() => {
    if (currency === "TRY") return null;
    const amt = parseTRYInput(amount);
    if (!amt) return null;
    return { value: toTRY(amt, currency, fxRates), rateDate: fxRates[currency]?.rate_date };
  }, [amount, currency, fxRates]);

  const save = async () => {
    if (!ensureHousehold(householdId)) return;
    if (!(owner.ownerType === "household" || owner.personId != null))
      return Alert.alert("Eksik", "Kime ait olduğunu seç.");
    const amountVal = parseTRYInput(amount);
    if (amountVal == null || amountVal < 0) return Alert.alert("Eksik", "Tutar gir.");
    let occurred: string | null = null;
    if (recurrence === "one_time") {
      const d = parseDate(occurredOn);
      if (!d) return Alert.alert("Eksik", "Tarihi GG.AA.YYYY gir.");
      occurred = d.toISOString().slice(0, 10);
    }
    setSaving(true);
    const payload = {
      household_id: householdId!,
      owner_type: owner.ownerType,
      person_id: owner.ownerType === "person" ? owner.personId : null,
      direction,
      category,
      label: label.trim() || null,
      amount: amountVal,
      currency,
      recurrence,
      occurred_on: occurred,
    };
    const { error } = editId
      ? await supabase.from("cash_flows").update(payload).eq("id", editId)
      : await supabase.from("cash_flows").insert(payload);
    setSaving(false);
    if (handleSaveError("add-cashflow", error, "Kayıt eklenemedi. Lütfen tekrar dene.")) return;
    if (!editId) track("cashflow_item_added", { direction, recurrence });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <OwnerSelect value={owner} onChange={setOwner} />
        {/* Sıklık — tek üst kontrol (Tür yön butonundan belli) */}
        <Text style={styles.label}>Sıklık</Text>
        <View style={styles.segment}>
          {(["monthly", "one_time"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRecurrence(r)}
              style={[styles.seg, recurrence === r && styles.segActive]}
            >
              <Text style={[styles.segText, recurrence === r && { color: colors.ink }]}>
                {r === "monthly" ? "Her ay" : "Tek seferlik"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Select label="Kategori" value={category} options={CATEGORIES[direction]} onChange={setCategory} />
        <Field
          label={recurrence === "monthly" ? "Aylık tutar" : "Tutar"}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="örn. 50.000"
        />
        {recurrence === "one_time" && (
          <Field label="Tarih" value={occurredOn} onChangeText={setOccurredOn} placeholder="GG.AA.YYYY" />
        )}
        <Select label="Para birimi" value={currency} options={currencyOptions} onChange={setCurrency} />
        {currency !== "TRY" && (
          <Text style={styles.fxNote}>
            {preview?.value != null
              ? `≈ ${formatTRY(preview.value)} · TCMB ${preview.rateDate ?? ""} alış kuru`
              : "Kur henüz çekilmedi"}
          </Text>
        )}
        <Field label="Açıklama (opsiyonel)" value={label} onChangeText={setLabel} placeholder="örn. Ana maaş" />
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
      {editId && <Button title="Kaydı sil" variant="link" onPress={removeItem} />}
    </ScrollView>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  fxNote: { color: colors.muted, fontSize: 13, marginTop: -spacing(0.5), marginBottom: spacing(1) },
  segment: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
  },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
};
