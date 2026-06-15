import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

// Onboarding: hane kur. Sonra "ilk hesabını ekle" + "aileni davet et" panodan akar.
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { refreshHouseholds, setHouseholdId } = useSession();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const createHousehold = async () => {
    if (!name.trim()) return Alert.alert("Eksik", "Haneye bir ad ver (örn. 'Bizim Ev').");
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_household", { p_name: name.trim() });
      if (error) throw error;
      setHouseholdId(data as string);
      await refreshHouseholds();
    } catch (e: any) {
      Alert.alert("Olmadı", e.message);
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
    } catch (e: any) {
      Alert.alert("Davet kabul edilemedi", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(3), paddingTop: insets.top + spacing(4) }}
    >
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.ink, marginBottom: spacing(1) }}>
        Haneni kur
      </Text>
      <Text style={{ color: colors.inkSoft, marginBottom: spacing(3) }}>
        Tüm aile borç ve birikimlerini tek panoda toplayacağız.
      </Text>

      <Card>
        <Field
          label="Hane adı"
          value={name}
          onChangeText={setName}
          placeholder="örn. Bizim Ev"
        />
        <Button title="Hane oluştur" onPress={createHousehold} loading={loading} />
      </Card>

      <Text style={{ textAlign: "center", color: colors.muted, marginVertical: spacing(1) }}>
        — veya —
      </Text>

      <Card>
        <Field
          label="Davet kodun mu var?"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          placeholder="davet kodu"
        />
        <Button title="Haneye katıl" variant="ghost" onPress={joinHousehold} loading={loading} />
      </Card>
    </ScrollView>
  );
}
