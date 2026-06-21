import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { BankSelect, Button, Card, Field } from "@/components/ui";
import { parseTRYInput } from "@/core/format";
import { colors, spacing } from "@/theme";
import type { DebtKind, Person } from "@/lib/database.types";

type Segment = "credit_card" | "kmh" | "loan";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "credit_card", label: "Kredi kartı" },
  { key: "kmh", label: "KMH" },
  { key: "loan", label: "Kredi" },
];

// "GG.AA.YYYY" -> Date | null
function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return d.getDate() === Number(dd) ? d : null;
}

export default function AddDebt() {
  const router = useRouter();
  const { householdId } = useSession();
  const [persons, setPersons] = useState<Person[]>([]);

  const [segment, setSegment] = useState<Segment>("credit_card");
  const [kmhMode, setKmhMode] = useState<"normal" | "installment">("normal");
  const [bank, setBank] = useState("");
  const [balance, setBalance] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [installment, setInstallment] = useState("");
  const [termCount, setTermCount] = useState("");
  const [firstInstallment, setFirstInstallment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const kind: DebtKind = useMemo(() => {
    if (segment === "kmh") return kmhMode === "installment" ? "kmh_installment" : "kmh";
    return segment;
  }, [segment, kmhMode]);

  const isInstallment = kind === "loan" || kind === "kmh_installment";

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
    if (!bank.trim()) return Alert.alert("Eksik", "Banka seç.");
    if (balanceVal == null || balanceVal <= 0) return Alert.alert("Eksik", "Borç tutarı gir.");

    let dueVal: number;
    let firstDate: Date | null = null;

    if (isInstallment) {
      const inst = parseTRYInput(installment);
      const terms = Number(termCount);
      firstDate = parseDate(firstInstallment);
      if (inst == null || inst <= 0) return Alert.alert("Eksik", "Aylık taksit tutarını gir.");
      if (!Number.isInteger(terms) || terms <= 0) return Alert.alert("Eksik", "Taksit sayısını gir.");
      if (!firstDate) return Alert.alert("Eksik", "İlk taksit tarihini GG.AA.YYYY gir.");
      dueVal = firstDate.getDate(); // due_day ilk taksit gününden türer
    } else {
      dueVal = Number(dueDay);
      if (!Number.isInteger(dueVal) || dueVal < 1 || dueVal > 31)
        return Alert.alert("Eksik", "Son ödeme gününü 1–31 arası gir.");
    }

    setSaving(true);
    const { error } = await supabase.from("debts").insert({
      household_id: householdId!,
      person_id: personId,
      kind,
      bank: bank.trim(),
      balance: balanceVal,
      card_limit: kind === "credit_card" ? parseTRYInput(cardLimit) : null,
      installment: isInstallment ? parseTRYInput(installment) : null,
      term_count: isInstallment ? Number(termCount) : null,
      first_installment_date: firstDate ? firstDate.toISOString().slice(0, 10) : null,
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
          {SEGMENTS.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              style={[styles.seg, segment === s.key && styles.segActive]}
            >
              <Text style={[styles.segText, segment === s.key && { color: colors.ink }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* KMH alt-toggle: Normal / Taksitli */}
        {segment === "kmh" && (
          <View style={[styles.segment, { marginTop: -spacing(0.5) }]}>
            {(["normal", "installment"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setKmhMode(m)}
                style={[styles.seg, kmhMode === m && styles.segActive]}
              >
                <Text style={[styles.segText, kmhMode === m && { color: colors.ink }]}>
                  {m === "normal" ? "Normal" : "Taksitli"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <BankSelect label="Banka" value={bank} onChange={setBank} />

        <Field
          label={isInstallment ? "Kalan borç tutarı" : "Borç tutarı"}
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

        {isInstallment && (
          <>
            <Field
              label="Aylık taksit"
              value={installment}
              onChangeText={setInstallment}
              keyboardType="numeric"
              placeholder="örn. 8.750"
            />
            <Field
              label="Taksit sayısı"
              value={termCount}
              onChangeText={setTermCount}
              keyboardType="numeric"
              placeholder="örn. 12"
            />
            <Field
              label="İlk taksit tarihi"
              value={firstInstallment}
              onChangeText={setFirstInstallment}
              placeholder="GG.AA.YYYY"
              hint="Son ödeme günü bu tarihten türetilir."
            />
          </>
        )}

        {!isInstallment && (
          <Field
            label="Son ödeme günü"
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="numeric"
            placeholder="1–31"
          />
        )}

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
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
};
