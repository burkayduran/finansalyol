import { Text } from "react-native";
import { Tabs } from "expo-router";
import { colors } from "@/theme";

const icon = (glyph: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 20, color }}>{glyph}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Pano", tabBarIcon: icon("🏠"), headerTitle: "Aile panosu" }}
      />
      <Tabs.Screen
        name="cashflow"
        options={{ title: "Gelir-gider", tabBarIcon: icon("📊") }}
      />
      <Tabs.Screen
        name="family"
        options={{ title: "Aile", tabBarIcon: icon("👪") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Ayarlar", tabBarIcon: icon("⚙️") }}
      />
    </Tabs>
  );
}
