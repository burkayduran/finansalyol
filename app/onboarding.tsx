import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { registerPushToken } from "@/lib/push";
import { track } from "@/lib/analytics";
import { BRAND } from "@/config/brand";
import { Button, Card, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

const PERSON_CHIPS = ["Eşim", "Ortak", "Annem", "Babam", "Kardeşim"];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { session, refreshHouseholds, setHouseholdId } = useSession();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [hhId, setHhId] = useState<string | null>(null);

  const [name, setName] = useState("Evimiz");
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  const createHousehold = async () => {
    if (!name.trim()) return Alert.alert("Eksik", "Haneye bir ad ver.");
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_household", { p_name: name.trim() });
      if (error) throw error;
      setHhId(data as string);
      track("household_created");
      setStep(1);
    } catch {
      Alert.alert("Olmadı", "Hane oluşturulamadı. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  const joinHousehold = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("accept_invite", { p_code: code.trim() });
      if (error) throw error;
      setHouseholdId(data as string);
      await refreshHouseholds();
    } catch {
      Alert.alert("Davet kabul edilemedi", "Kod geçersiz ya da süresi dolmuş olabilir.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const savePeopleAndContinue = async () => {
    if (!hhId) return;
    const names = [...selected];
    if (custom.trim()) names.push(custom.trim());
    if (names.length > 0) {
      await supabase.from("persons").insert(names.map((display_name) => ({ household_id: hhId, display_name })));
      names.forEach(() => track("person_added"));
    }
    setStep(2);
  };

  const finish = async (enableNotifications: boolean) => {
    if (enableNotifications && session) {
      await registerPushToken(session.user.id).catch(() => {});
      track("notification_enabled", { push_enabled: true });
    }
    track("onboarding_completed");
    if (hhId) {
      setHouseholdId(hhId);
      await refreshHouseholds();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(3), paddingTop: insets.top + spacing(4) }}>
      {step === 0 && (
        <>
          <Text style={styles.title}>{BRAND.appName}</Text>
          <Text style={styles.sub}>Aileni veya haneni oluştur. {BRAND.tagline}</Text>
          <Card>
            <Field label="Hane adı" value={name} onChangeText={setName} placeholder="örn. Evimiz" />
            <Button title="Devam" onPress={createHousehold} loading={loading} />
          </Card>
          <Text style={{ textAlign: "center", color: colors.muted, marginVertical: spacing(1) }}>— veya —</Text>
          <Card>
            <Field label="Davet kodun mu var?" value={code} onChangeText={setCode} autoCapitalize="none" placeholder="davet kodu" />
            <Button title="Haneye katıl" variant="ghost" onPress={joinHousehold} loading={loading} />
          </Card>
        </>
      )}

      {step === 1 && (
        <>
          <Text style={styles.title}>Kimler var?</Text>
          <Text style={styles.sub}>Borç ve varlıkları kişilere bağlayabilmen için. "Ben" otomatik eklendi.</Text>
          <Card>
            <View style={styles.chips}>
              {PERSON_CHIPS.map((c) => (
                <Pressable key={c} onPress={() => toggle(c)} style={[styles.chip, selected.includes(c) && styles.chipOn]}>
                  <Text style={[styles.chipText, selected.includes(c) && { color: colors.ink }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Başka biri" value={custom} onChangeText={setCustom} placeholder="örn. Kayınvalidem" />
            <Button title="Devam" onPress={savePeopleAndContinue} />
            <Button title="Şimdilik geç" variant="link" onPress={() => setStep(2)} />
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.title}>Hatırlatmalar</Text>
          <Text style={styles.sub}>Ödeme günleri yaklaşınca hatırlatalım.</Text>
          <Card>
            <Button title="Bildirimleri aç" onPress={() => finish(true)} />
            <Button title="Şimdilik geç" variant="ghost" onPress={() => finish(false)} />
          </Card>
          <Text style={{ color: colors.muted, marginTop: spacing(2), textAlign: "center" }}>
            İlk borç, varlık veya ödemeni birazdan "Ekle" ile girebilirsin.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = {
  title: { fontSize: 26, fontWeight: "800" as const, color: colors.ink, marginBottom: spacing(0.5) },
  sub: { color: colors.inkSoft, marginBottom: spacing(2) },
  chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: spacing(1) },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.inkSoft, fontWeight: "600" as const },
};
