import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { registerPushToken } from "@/lib/push";
import { colors } from "@/theme";

function RootNavigator() {
  const { session, loading, householdId } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Oturum açıldıysa push token'ı kaydet.
  useEffect(() => {
    if (session?.user.id) registerPushToken(session.user.id).catch(() => {});
  }, [session?.user.id]);

  // Yönlendirme bekçisi: oturum yoksa giriş; hane yoksa onboarding.
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "sign-in";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inAuth) {
      router.replace("/sign-in");
    } else if (session && !householdId && !inOnboarding) {
      router.replace("/onboarding");
    } else if (session && householdId && (inAuth || inOnboarding)) {
      router.replace("/");
    }
  }, [session, householdId, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-debt" options={{ presentation: "modal", headerShown: true, title: "Borç ekle" }} />
      <Stack.Screen name="add-asset" options={{ presentation: "modal", headerShown: true, title: "Varlık ekle" }} />
      <Stack.Screen name="add-cashflow" options={{ presentation: "modal", headerShown: true, title: "Gelir / Gider" }} />
      <Stack.Screen name="debt/[id]" options={{ headerShown: true, title: "Borç" }} />
      <Stack.Screen name="person/[id]" options={{ headerShown: true, title: "Kişi" }} />
      <Stack.Screen name="household" options={{ headerShown: true, title: "Ortak / Hane" }} />
      <Stack.Screen name="assets" options={{ headerShown: true, title: "Varlıklar" }} />
      <Stack.Screen name="projection" options={{ headerShown: true, title: "Gelecek aylar" }} />
      <Stack.Screen name="cashflow" options={{ headerShown: true, title: "Gelir-gider" }} />
      <Stack.Screen name="family" options={{ headerShown: true, title: "Aile" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
