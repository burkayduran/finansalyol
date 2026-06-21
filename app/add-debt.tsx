import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { BankSelect, Button, Card, Field } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { installmentsRemaining, outstandingInstallment } from "@/core/installment";
import { colors, spacing } from "@/theme";
import type { DebtKind, Person } from "@/lib/database.types";

type Segment = "credit_card" | "kmh" | "loan";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "credit_card", label: "Kredi kartı" },
  { key: "kmh", label: "KMH" },
  { key: "loan", label: "Kredi" },
];

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

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
  const [balance, setBalance] = useState(""); // credit_card/kmh: dönem borcu/bakiye
  const [totalAmount, setTotalAmount] = useState(""); // loan/kmh_installment: toplam tutar
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

  // Canlı özet: kalan taksit · ≈ kalan borç · bitiş.
  const summary = useMemo(() => {
    if (!isInstallment) return null;
    const inst = parseTRYInput(installment);
    const terms = Number(termCount);
    const first = parseDate(firstInstallment);
    if (!inst || !Number.isInteger(terms) || terms <= 0 || !first) return null;
    const remaining = installmentsRemaining(first, terms);
    const outstanding = outstandingInstallment({ installment: inst, termCount: terms, firstInstallmentDate: first });
    const end = new Date(first);
    end.setMonth(end.getMonth() + terms - 1);
    return { remaining, outstanding, end };
  }, [isInstallment, installment, termCount, firstInstallment]);

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
    if (!bank.trim()) return Alert.alert("Eksik", "Banka seç.");

    let dueVal: number;
    let firstDate: Date | null = null;
    let balanceToStore: number;
    let totalToStore: number | null = null;

    if (isInstallment) {
      const total = parseTRYInput(totalAmount);
      const inst = parseTRYInput(installment);
      const terms = Number(termCount);
      firstDate = parseDate(firstInstallment);
      if (total == null || total <= 0) return Alert.alert("Eksik", "Toplam tutarı gir.");
      if (inst == null || inst <= 0) return Alert.alert("Eksik", "Aylık taksit tutarını gir.");
      if (!Number.isInteger(terms) || terms <= 0) return Alert.alert("Eksik", "Taksit sayısını gir.");
      if (!firstDate) return Alert.alert("Eksik", "İlk taksit tarihini GG.AA.YYYY gir.");
      dueVal = firstDate.getDate();
      totalToStore = total;
      balanceToStore = total; // referans; kalan borç programdan türetilir
    } else {
      const balanceVal = parseTRYInput(balance);
      dueVal = Number(dueDay);
      if (balanceVal == null || balanceVal <= 0) return Alert.alert("Eksik", "Borç tutarı gir.");
      if (!Number.isInteger(dueVal) || dueVal < 1 || dueVal > 31)
        return Alert.alert("Eksik", "Son ödeme gününü 1–31 arası gir.");
      balanceToStore = balanceVal;
    }

    setSaving(true);
    const { error } = await supabase.from("debts").insert({
      household_id: householdId!,
      person_id: personId,
      kind,
      bank: bank.trim(),
      balance: balanceToStore,
      total_amount: totalToStore,
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

        {isInstallment ? (
          <>
            <Field
              label="Toplam tutar"
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="numeric"
              placeholder="örn. 120.000"
              hint="Kalan borç ve aylar bundan türetilir."
            />
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
            {summary && (
              <View style={styles.summaryBox}>
                <Text style={{ color: colors.ink, fontWeight: "600" }}>
                  Kalan {summary.remaining} taksit · ≈ {formatTRY(summary.outstanding)} kalan borç
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Bitiş: {TR_MONTHS[summary.end.getMonth()]} {summary.end.getFullYear()}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Field
              label="Borç tutarı"
              value={balance}
              onChangeText={setBalance}
              keyboardType="numeric"
              placeholder="örn. 71.000"
            />
            <Field
              label="Son ödeme günü"
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="numeric"
              placeholder="1–31"
            />
          </>
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
  summaryBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing(1.5),
    marginBottom: spacing(1),
  },
};
