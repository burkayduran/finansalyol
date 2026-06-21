import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field, Select } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/core/currencies";
import { toTRY } from "@/core/fx";
import { useFxRates } from "@/hooks/useFxRates";
import { colors, spacing } from "@/theme";
import type { CashFlowDirection } from "@/lib/database.types";

const CATEGORIES: Record<CashFlowDirection, { value: string; label: string }[]> = {
  income: [
    { value: "salary", label: "Maaş" },
    { value: "rent", label: "Kira geliri" },
    { value: "interest", label: "Faiz geliri" },
    { value: "other", label: "Diğer" },
  ],
  expense: [
    { value: "rent", label: "Kira gideri" },
    { value: "bill", label: "Fatura" },
    { value: "subscription", label: "Abonelik" },
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
  const { householdId } = useSession();
  const fxRates = useFxRates();
  const params = useLocalSearchParams<{ direction?: string }>();
  const [direction, setDirection] = useState<CashFlowDirection>(
    params.direction === "expense" ? "expense" : "income"
  );
  const [recurrence, setRecurrence] = useState<"monthly" | "one_time">("monthly");
  const [category, setCategory] = useState("salary");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [occurredOn, setOccurredOn] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const switchDirection = (d: CashFlowDirection) => {
    setDirection(d);
    setCategory(CATEGORIES[d][0].value);
  };

  const preview = useMemo(() => {
    if (currency === "TRY") return null;
    const amt = parseTRYInput(amount);
    if (!amt) return null;
    const v = toTRY(amt, currency, fxRates);
    return { value: v, rateDate: fxRates[currency]?.rate_date };
  }, [amount, currency, fxRates]);

  const save = async () => {
    const amountVal = parseTRYInput(amount);
    if (amountVal == null || amountVal < 0) return Alert.alert("Eksik", "Tutar gir.");
    let occurred: string | null = null;
    if (recurrence === "one_time") {
      const d = parseDate(occurredOn);
      if (!d) return Alert.alert("Eksik", "Tarihi GG.AA.YYYY gir.");
      occurred = d.toISOString().slice(0, 10);
    }
    setSaving(true);
    const { error } = await supabase.from("cash_flows").insert({
      household_id: householdId!,
      direction,
      category,
      label: label.trim() || null,
      amount: amountVal,
      currency,
      recurrence,
      occurred_on: occurred,
    });
    setSaving(false);
    if (error) return Alert.alert("Olmadı", error.message);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <View style={styles.segment}>
          {(["income", "expense"] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => switchDirection(d)}
              style={[styles.seg, direction === d && styles.segActive]}
            >
              <Text style={[styles.segText, direction === d && { color: colors.ink }]}>
                {d === "income" ? "Gelir" : "Düzenli gider"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.segment, { marginTop: -spacing(0.5) }]}>
          {(["monthly", "one_time"] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRecurrence(r)}
              style={[styles.seg, recurrence === r && styles.segActive]}
            >
              <Text style={[styles.segText, recurrence === r && { color: colors.ink }]}>
                {r === "monthly" ? "Aylık" : "Tek seferlik"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Select
          label="Kategori"
          value={category}
          options={CATEGORIES[direction]}
          onChange={setCategory}
        />
        <Field label="Açıklama (opsiyonel)" value={label} onChangeText={setLabel} placeholder="örn. Ana maaş" />
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
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: -spacing(0.5), marginBottom: spacing(1) }}>
            {preview?.value != null
              ? `≈ ${formatTRY(preview.value)} · TCMB ${preview.rateDate ?? ""} alış kuru`
              : "Kur henüz çekilmedi"}
          </Text>
        )}
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = {
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
