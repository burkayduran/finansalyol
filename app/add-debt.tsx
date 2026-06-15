import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { parseTRYInput } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { DebtKind, Person } from "@/lib/database.types";

const KINDS: { key: DebtKind; label: string }[] = [
  { key: "credit_card", label: "Kredi kartı" },
  { key: "kmh", label: "KMH" },
  { key: "loan", label: "Kredi" },
];

export default function AddDebt() {
  const router = useRouter();
  const { householdId } = useSession();
  const [persons, setPersons] = useState<Person[]>([]);

  const [kind, setKind] = useState<DebtKind>("credit_card");
  const [bank, setBank] = useState("");
  const [balance, setBalance] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [installment, setInstallment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    supabase
      .from("persons")
      .select("*")
      .eq("household_id", householdId)
      .then(({ data }) => {
        setPersons(data ?? []);
        setPersonId(data?.[0]?.id ?? null);
      });
  }, [householdId]);

  const save = async () => {
    const balanceVal = parseTRYInput(balance);
    const dueVal = Number(dueDay);
    if (!bank.trim()) return Alert.alert("Eksik", "Banka adı gir.");
    if (balanceVal == null || balanceVal <= 0) return Alert.alert("Eksik", "Borç tutarı gir.");
    if (!Number.isInteger(dueVal) || dueVal < 1 || dueVal > 31)
      return Alert.alert("Eksik", "Son ödeme gününü 1–31 arası gir.");

    setSaving(true);
    const { error } = await supabase.from("debts").insert({
      household_id: householdId!,
      person_id: personId,
      kind,
      bank: bank.trim(),
      balance: balanceVal,
      card_limit: kind === "credit_card" ? parseTRYInput(cardLimit) : null,
      installment: kind === "loan" ? parseTRYInput(installment) : null,
      due_day: dueVal,
    });
    setSaving(false);
    if (error) return Alert.alert("Olmadı", error.message);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.label}>Borç türü</Text>
        <View style={styles.segment}>
          {KINDS.map((k) => (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={[styles.seg, kind === k.key && styles.segActive]}
            >
              <Text style={[styles.segText, kind === k.key && { color: colors.ink }]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Banka" value={bank} onChangeText={setBank} placeholder="örn. VakıfBank" />
        <Field
          label="Borç tutarı"
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          placeholder="örn. 71.000"
        />
        {kind === "credit_card" && (
          <Field
            label="Kart limiti"
            value={cardLimit}
            onChangeText={setCardLimit}
            keyboardType="numeric"
            placeholder="örn. 90.000"
            hint="Asgari oranını belirler (limit ≤ 50.000 → %20, üzeri → %40)."
          />
        )}
        {kind === "loan" && (
          <Field
            label="Aylık taksit (varsa)"
            value={installment}
            onChangeText={setInstallment}
            keyboardType="numeric"
            placeholder="örn. 8.750"
          />
        )}
        <Field
          label="Son ödeme günü"
          value={dueDay}
          onChangeText={setDueDay}
          keyboardType="numeric"
          placeholder="1–31"
        />

        {persons.length > 0 && (
          <>
            <Text style={styles.label}>Kime ait?</Text>
            <View style={styles.segment}>
              {persons.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setPersonId(p.id)}
                  style={[styles.seg, personId === p.id && styles.segActive]}
                >
                  <Text style={[styles.segText, personId === p.id && { color: colors.ink }]}>
                    {p.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Card>

      <Button title="Kaydet" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  segment: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: spacing(1.5),
  },
  seg: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  segActive: { backgroundColor: "#d1fae5", borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
};
