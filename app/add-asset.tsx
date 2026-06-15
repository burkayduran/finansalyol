import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { parseTRYInput } from "@/core/format";
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
  const [saving, setSaving] = useState(false);

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
          label="Tutar"
          value={balance}
          onChangeText={setBalance}
          keyboardType="numeric"
          placeholder="örn. 25.000"
        />
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
    </ScrollView>
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
  segActive: { backgroundColor: "#d1fae5", borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
};
