import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { recordSignupAcceptance } from "@/lib/legal";
import { BRAND } from "@/config/brand";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false); // Koşullar kabulü (önceden işaretsiz)
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return Alert.alert("Eksik bilgi", "E-posta ve şifre gerekli.");
    if (mode === "sign_up" && !accepted) {
      return Alert.alert("Onay gerekli", "Devam etmek için Kullanım Koşulları'nı kabul etmelisin.");
    }
    setLoading(true);
    try {
      if (mode === "sign_up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        await recordSignupAcceptance(data.session);
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

  const forgotPassword = async () => {
    if (!email) return Alert.alert("E-posta gir", "Sıfırlama bağlantısı için e-postanı yaz.");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "finansalyol://reset-password",
      });
      if (error) throw error;
      Alert.alert("Gönderildi", "Sıfırlama bağlantısı e-postana gönderildi.");
    } catch {
      Alert.alert("Olmadı", "Bağlantı gönderilemedi. E-postanı kontrol et.");
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

        {mode === "sign_up" && (
          <Pressable
            onPress={() => setAccepted((v) => !v)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginVertical: spacing(1) }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="Kullanım Koşulları'nı kabul et"
          >
            <View
              style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2, marginTop: 1,
                borderColor: accepted ? colors.primary : colors.muted,
                backgroundColor: accepted ? colors.primary : "transparent",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {accepted && <Text style={{ color: colors.primaryInk, fontWeight: "800" }}>✓</Text>}
            </View>
            <Text style={{ color: colors.inkSoft, flex: 1, fontSize: 13 }}>
              <Text style={{ color: colors.accent, fontWeight: "700" }} onPress={() => router.push("/legal/terms")}>Kullanım Koşulları</Text>
              {"'nı kabul ediyorum; "}
              <Text style={{ color: colors.accent, fontWeight: "700" }} onPress={() => router.push("/legal/kvkk")}>KVKK Aydınlatma Metni</Text>
              {" ile "}
              <Text style={{ color: colors.accent, fontWeight: "700" }} onPress={() => router.push("/legal/privacy")}>Gizlilik Politikası</Text>
              {"'nı okudum."}
            </Text>
          </Pressable>
        )}

        <Button
          title={mode === "sign_in" ? "Giriş yap" : "Hesap oluştur"}
          onPress={submit}
          loading={loading}
          disabled={mode === "sign_up" && !accepted}
        />
        <Button
          title={mode === "sign_in" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
          variant="link"
          onPress={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
        />
        {mode === "sign_in" && (
          <Button title="Şifremi unuttum" variant="link" onPress={forgotPassword} />
        )}

        <View style={{ height: insets.bottom + spacing(2) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
