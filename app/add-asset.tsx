import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { formatShortDate } from "@/core/dates";
import { depositYield } from "@/core/deposit";
import { colors, spacing } from "@/theme";
import type { AssetKind } from "@/lib/database.types";

const KINDS: { key: AssetKind; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "deposit", label: "Mevduat" },
  { key: "fund", label: "Fon" },
  { key: "other", label: "Diğer" },
];

export default function AddAsset() {
  const router = useRouter();
  const { householdId } = useSession();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AssetKind>("deposit");
  const [balance, setBalance] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [termDays, setTermDays] = useState("");
  const [stopaj, setStopaj] = useState("");
  const [saving, setSaving] = useState(false);

  const isDeposit = kind === "deposit";

  const preview = useMemo(() => {
    if (!isDeposit) return null;
    const principal = parseTRYInput(balance);
    const rate = parseTRYInput(annualRate);
    const days = Number(termDays);
    const tax = parseTRYInput(stopaj);
    if (!principal || !rate || !days) return null;
    return depositYield({ principal, annualRate: rate, termDays: days, stopaj: tax ?? 0 });
  }, [isDeposit, balance, annualRate, termDays, stopaj]);

  const save = async () => {
    const balanceVal = parseTRYInput(balance);
    if (!label.trim()) return Alert.alert("Eksik", "Bir etiket gir (örn. 'Acil fon').");
    if (balanceVal == null || balanceVal < 0) return Alert.alert("Eksik", "Tutar gir.");

    setSaving(true);
    const { error } = await supabase.from("assets").insert({
      household_id: householdId!,
      label: label.trim(),
      kind,
      balance: balanceVal,
      annual_rate: isDeposit ? parseTRYInput(annualRate) : null,
      term_days: isDeposit && termDays ? Number(termDays) : null,
      stopaj: isDeposit ? parseTRYInput(stopaj) : null,
      start_date: isDeposit ? new Date().toISOString().slice(0, 10) : null,
    });
    setSaving(false);
    if (error) return Alert.alert("Olmadı", error.message);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Field label="Etiket" value={label} onChangeText={setLabel} placeholder="örn. Acil fon" />
        <Text style={styles.label}>Tür</Text>
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
        <Field
          label={isDeposit ? "Anapara" : "Tutar"}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          placeholder="örn. 25.000"
        />

        {isDeposit && (
          <>
            <Field
              label="Yıllık faiz (%)"
              value={annualRate}
              onChangeText={setAnnualRate}
              keyboardType="numeric"
              placeholder="örn. 45"
            />
            <Field
              label="Vade (gün)"
              value={termDays}
              onChangeText={setTermDays}
              keyboardType="numeric"
              placeholder="örn. 92"
            />
            <Field
              label="Stopaj (%)"
              value={stopaj}
              onChangeText={setStopaj}
              keyboardType="numeric"
              placeholder="örn. 7.5"
            />

            {preview && (
              <View style={styles.yieldBox}>
                <YieldRow label="Brüt faiz" value={formatTRY(preview.grossInterest)} />
                <YieldRow label="Stopaj" value={"−" + formatTRY(preview.tax)} />
                <YieldRow label="Net faiz" value={formatTRY(preview.netInterest)} strong />
                <YieldRow label="Vade sonu" value={formatTRY(preview.maturityValue)} strong />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {formatShortDate(preview.maturityDate)} · ≈ tahmini
                </Text>
              </View>
            )}
          </>
        )}
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
    </ScrollView>
  );
}

function YieldRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.yieldRow}>
      <Text style={{ color: colors.inkSoft }}>{label}</Text>
      <Text style={{ color: colors.ink, fontWeight: strong ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  segment: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: spacing(1.5) },
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
  yieldBox: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: spacing(1.5),
    marginTop: spacing(0.5),
  },
  yieldRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 3,
  },
};
