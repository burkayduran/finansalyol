import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { colors } from "@/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;
const tabIcon = (base: string, size = 24) =>
  ({ color, focused }: { color: string; focused: boolean }) =>
    <Ionicons name={(focused ? base : `${base}-outline`) as IoniconName} size={size} color={color} />;

function AddButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/add")} hitSlop={10} style={{ paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name="add" size={18} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 16 }}>Ekle</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.ink },
        headerRight: () => <AddButton />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Özet", tabBarIcon: tabIcon("home"), headerTitle: "Özet" }} />
      <Tabs.Screen name="people" options={{ title: "Aile", tabBarIcon: tabIcon("people"), headerTitle: "Aile" }} />
      <Tabs.Screen
        name="add"
        options={{
          title: "Ekle", headerTitle: "Yeni kayıt",
          tabBarIcon: () => <Ionicons name="add-circle" size={30} color={colors.primary} />,
        }}
      />
      <Tabs.Screen name="calendar" options={{ title: "Ödemeler", tabBarIcon: tabIcon("calendar"), headerTitle: "Ödeme planı" }} />
      <Tabs.Screen name="settings" options={{ title: "Hesabım", tabBarIcon: tabIcon("settings"), headerTitle: "Hesabım" }} />
    </Tabs>
  );
}
