import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { BRAND } from "@/config/brand";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert("Eksik bilgi", "E-posta ve şifre gerekli.");
    setLoading(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        track("account_created");
        Alert.alert("Hoş geldin", "Hesabın oluşturuldu, giriş yapılıyor.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      Alert.alert("Olmadı", e.message ?? "Bir şeyler ters gitti.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing(3),
          paddingTop: insets.top + spacing(6),
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.ink }}>{BRAND.appName}</Text>
        <Text style={{ fontSize: 16, color: colors.inkSoft, marginTop: spacing(1), marginBottom: spacing(3) }}>
          {BRAND.tagline}
        </Text>

        {mode === "sign_up" && (
          <Field label="Adın" value={fullName} onChangeText={setFullName} placeholder="örn. Ayşe" />
        )}
        <Field
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ornek@eposta.com"
        />
        <Field
          label="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <Button
          title={mode === "sign_in" ? "Giriş yap" : "Hesap oluştur"}
          onPress={submit}
          loading={loading}
        />
        <Button
          title={mode === "sign_in" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
          variant="link"
          onPress={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
        />

        <View style={{ height: insets.bottom + spacing(2) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
