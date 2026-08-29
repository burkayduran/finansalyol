import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const { clearRecovery, refreshHouseholds } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) return Alert.alert("Zayıf şifre", "En az 6 karakter gir.");
    if (password !== confirm) return Alert.alert("Eşleşmiyor", "Şifreler aynı değil.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearRecovery();
      await refreshHouseholds();
      Alert.alert("Tamam", "Şifren güncellendi.");
    } catch {
      Alert.alert("Olmadı", "Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir; tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(3), paddingTop: insets.top + spacing(6), flexGrow: 1, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: spacing(1) }}>Yeni şifre belirle</Text>
      <Text style={{ color: colors.inkSoft, marginBottom: spacing(2) }}>Hesabın için yeni bir şifre gir.</Text>
      <Card>
        <Field label="Yeni şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <Field label="Yeni şifre (tekrar)" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" />
        <Button title="Şifreyi güncelle" onPress={submit} loading={loading} />
      </Card>
    </ScrollView>
  );
}
