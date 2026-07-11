import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { registerPushToken } from "@/lib/push";
import { track } from "@/lib/analytics";
import { BRAND } from "@/config/brand";
import { Button, Card, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

// Free-model onboarding: hane oluştur/katıl → bildirim. Aile üyesi ekleme YOK
// (aile takibi premium; kişi ekleme sonradan /family'de, gate ardında).
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { session, refreshHouseholds, setHouseholdId } = useSession();
  const [step, setStep] = useState<0 | 1>(0);
  const [hhId, setHhId] = useState<string | null>(null);

  const [name, setName] = useState("Hesabım");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const createHousehold = async () => {
    if (!name.trim()) return Alert.alert("Eksik", "Bir ad ver.");
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_household", { p_name: name.trim() });
      if (error) throw error;
      setHhId(data as string);
      track("household_created");
      setStep(1);
    } catch {
      Alert.alert("Olmadı", "Oluşturulamadı. Lütfen tekrar dene.");
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
          <Text style={styles.sub}>Başlamak için hesabını oluştur. {BRAND.tagline}</Text>
          <Card>
            <Field label="Ad" value={name} onChangeText={setName} placeholder="örn. Hesabım" />
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
          <Text style={styles.title}>Hatırlatmalar</Text>
          <Text style={styles.sub}>Ödeme günleri yaklaşınca ücretsiz push ile hatırlatalım.</Text>
          <Card>
            <Button title="Bildirimleri aç" onPress={() => finish(true)} />
            <Button title="Şimdilik geç" variant="ghost" onPress={() => finish(false)} />
          </Card>
          <Text style={{ color: colors.muted, marginTop: spacing(2), textAlign: "center" }}>
            İlk borcunu birazdan "Ekle" ile girebilirsin.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = {
  title: { fontSize: 26, fontWeight: "800" as const, color: colors.ink, marginBottom: spacing(0.5) },
  sub: { color: colors.inkSoft, marginBottom: spacing(2) },
};
