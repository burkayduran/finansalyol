// "Kimin için?" seçici — kişiler + Ortak/Hane. owner_type + person_id üretir.
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import type { OwnerType, Person } from "@/lib/database.types";
import { colors, spacing } from "@/theme";

export interface OwnerValue {
  ownerType: OwnerType;
  personId: string | null;
}

export function OwnerSelect({
  value,
  onChange,
}: {
  value: OwnerValue;
  onChange: (v: OwnerValue) => void;
}) {
  const { householdId } = useSession();
  const [persons, setPersons] = useState<Person[]>([]);
  const autoSet = useRef(false);

  useEffect(() => {
    if (!householdId) return;
    supabase
      .from("persons")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_archived", false)
      .then(({ data }) => setPersons(data ?? []));
  }, [householdId]);

  // Akıllı varsayılan: seçim yoksa "Ben" varsa onu, yoksa tek kişiyi otomatik seç.
  useEffect(() => {
    if (autoSet.current) return;
    if (persons.length === 0) return;
    if (value.ownerType === "person" && value.personId == null) {
      const me = persons.find((p) => p.display_name.trim().toLocaleLowerCase("tr") === "ben");
      const pick = me ?? (persons.length === 1 ? persons[0] : null);
      if (pick) {
        autoSet.current = true;
        onChange({ ownerType: "person", personId: pick.id });
      }
    }
  }, [persons, value, onChange]);

  const isActive = (p: Person) => value.ownerType === "person" && value.personId === p.id;

  return (
    <View style={{ marginBottom: spacing(1.5) }}>
      <Text style={styles.label}>Kimin için?</Text>
      <View style={styles.wrap}>
        {persons.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onChange({ ownerType: "person", personId: p.id })}
            style={[styles.chip, isActive(p) && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive(p) && { color: colors.ink }]}>{p.display_name}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => onChange({ ownerType: "household", personId: null })}
          style={[styles.chip, value.ownerType === "household" && styles.chipActive]}
        >
          <Text style={[styles.chipText, value.ownerType === "household" && { color: colors.ink }]}>
            Ortak / Hane
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  wrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontWeight: "600" as const },
};
