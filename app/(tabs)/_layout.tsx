import { Pressable, Text } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { colors } from "@/theme";

const icon = (glyph: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

function AddButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/add")} hitSlop={10} style={{ paddingHorizontal: 14 }}>
      <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 16 }}>+ Ekle</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.ink },
        headerRight: () => <AddButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Pano", tabBarIcon: icon("🏠"), headerTitle: "Aile panosu" }} />
      <Tabs.Screen name="people" options={{ title: "Kişiler", tabBarIcon: icon("👪") }} />
      <Tabs.Screen name="calendar" options={{ title: "Takvim", tabBarIcon: icon("🗓️") }} />
      <Tabs.Screen name="assets" options={{ title: "Varlıklar", tabBarIcon: icon("💰") }} />
      <Tabs.Screen name="settings" options={{ title: "Ayarlar", tabBarIcon: icon("⚙️") }} />
    </Tabs>
  );
}
