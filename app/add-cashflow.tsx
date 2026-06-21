import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field, Select } from "@/components/ui";
import { parseTRYInput } from "@/core/format";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/core/currencies";
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

export default function AddCashflow() {
  const router = useRouter();
  const { householdId } = useSession();
  const params = useLocalSearchParams<{ direction?: string }>();
  const [direction, setDirection] = useState<CashFlowDirection>(
    params.direction === "expense" ? "expense" : "income"
  );
  const [category, setCategory] = useState("salary");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);

  const switchDirection = (d: CashFlowDirection) => {
    setDirection(d);
    setCategory(CATEGORIES[d][0].value);
  };

  const save = async () => {
    const amountVal = parseTRYInput(amount);
    if (amountVal == null || amountVal < 0) return Alert.alert("Eksik", "Tutar gir.");
    setSaving(true);
    const { error } = await supabase.from("cash_flows").insert({
      household_id: householdId!,
      direction,
      category,
      label: label.trim() || null,
      amount: amountVal,
      currency,
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

        <Select
          label="Kategori"
          value={category}
          options={CATEGORIES[direction]}
          onChange={setCategory}
        />
        <Field label="Açıklama (opsiyonel)" value={label} onChangeText={setLabel} placeholder="örn. Ana maaş" />
        <Field
          label="Aylık tutar"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="örn. 50.000"
        />
        <Select label="Para birimi" value={currency} options={currencyOptions} onChange={setCurrency} />
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
