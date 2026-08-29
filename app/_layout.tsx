import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";

const INTRO_SEEN_KEY = "fy_intro_seen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { EntitlementProvider } from "@/config/entitlements";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { registerPushToken } from "@/lib/push";
import { handleAuthUrl } from "@/lib/deepLinks";
import { identify } from "@/lib/analytics";
import { flushPendingAcceptance } from "@/lib/legal";
import { colors } from "@/theme";

function RootNavigator() {
  const { session, loading, householdId, recovery } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Oturum açıldıysa push token'ı kaydet + analytics identify (yalnız user_id).
  useEffect(() => {
    if (session?.user.id) {
      registerPushToken(session.user.id).catch(() => {});
      identify(session.user.id);
      flushPendingAcceptance(session.user.id).catch(() => {});
    }
  }, [session?.user.id]);

  // Gelen auth deep-link'lerini işle (şifre sıfırlama vb.).
  useEffect(() => {
    Linking.getInitialURL().then(handleAuthUrl);
    const sub = Linking.addEventListener("url", ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  // Yönlendirme bekçisi: oturum yoksa giriş; ilk açılış intro; hane yoksa onboarding.
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "sign-in";
    const inOnboarding = segments[0] === "onboarding";
    const inReset = segments[0] === "reset-password";
    const inIntro = segments[0] === "intro";

    // Şifre sıfırlama akışı: kullanıcıyı ana ekrana fırlatma, reset ekranında tut.
    if (recovery) {
      if (!inReset) router.replace("/reset-password");
      return;
    }
    if (inReset) return;

    if (!session) {
      if (!inAuth) router.replace("/sign-in");
      return;
    }

    // Oturum var: ilk açılış intro'su (bir kez).
    (async () => {
      const introSeen = (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === "1";
      if (!introSeen) {
        if (!inIntro) router.replace("/intro");
        return;
      }
      if (!householdId && !inOnboarding) {
        router.replace("/onboarding");
      } else if (householdId && (inAuth || inOnboarding || inIntro)) {
        router.replace("/");
      }
    })();
  }, [session, householdId, loading, segments, recovery]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-debt" options={{ presentation: "modal", headerShown: true, title: "Borç ekle" }} />
      <Stack.Screen name="add-asset" options={{ presentation: "modal", headerShown: true, title: "Varlık ekle" }} />
      <Stack.Screen name="add-cashflow" options={{ presentation: "modal", headerShown: true, title: "Gelir / Gider" }} />
      <Stack.Screen name="debt/[id]" options={{ headerShown: true, title: "Borç" }} />
      <Stack.Screen name="person/[id]" options={{ headerShown: true, title: "Kişi" }} />
      <Stack.Screen name="household" options={{ headerShown: true, title: "Ortak / Hane" }} />
      <Stack.Screen name="assets" options={{ headerShown: true, title: "Varlıklar" }} />
      <Stack.Screen name="debts" options={{ headerShown: true, title: "Borçlar" }} />
      <Stack.Screen name="legal/privacy" options={{ headerShown: true, title: "Gizlilik Politikası" }} />
      <Stack.Screen name="legal/kvkk" options={{ headerShown: true, title: "KVKK Aydınlatma" }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: true, title: "Kullanım Şartları" }} />
      <Stack.Screen name="projection" options={{ headerShown: true, title: "Gelecek aylar" }} />
      <Stack.Screen name="cashflow" options={{ headerShown: true, title: "Nakit akışı" }} />
      <Stack.Screen name="pay" options={{ presentation: "modal", headerShown: true, title: "Ödeme gir" }} />
      <Stack.Screen name="consult" options={{ presentation: "modal", headerShown: true, title: "Borç Azaltma Planı" }} />
      <Stack.Screen name="delete-account" options={{ headerShown: true, title: "Hesabımı sil" }} />
      <Stack.Screen name="family" options={{ headerShown: true, title: "Aile" }} />
      <Stack.Screen name="paywall" options={{ presentation: "modal", headerShown: true, title: "Premium" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <SessionProvider>
          <EntitlementProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </EntitlementProvider>
        </SessionProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
