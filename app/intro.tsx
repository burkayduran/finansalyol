import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Card } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

// İlk açılış mini anlatımı — free planda ne yapılır, premium'da ne açılır. Bir kez gösterilir.
export const INTRO_SEEN_KEY = "fy_intro_seen";

const CARDS = [
  {
    title: "Borçlarını tek yerde takip et",
    body: "Kredi kartı, KMH ve kredilerini ekleyip kalan borçlarını ve ödeme tarihlerini görebilirsin.",
  },
  {
    title: "Ödemeleri kaçırma",
    body: "Yaklaşan ödemeler için ücretsiz push bildirimi alabilirsin.",
  },
  {
    title: "Daha fazlası Aile Paketi’nde",
    body: "Aile takibi, nakit akışı, varlık takibi ve mail uyarıları Aile Paketi ile açılır.",
  },
];

export default function Intro() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const last = step === CARDS.length - 1;
  const c = CARDS[step];

  const finish = async (dest: string) => {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, "1");
    router.replace(dest);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(3), flexGrow: 1, justifyContent: "center" }}>
      <Text style={{ color: colors.accent, fontWeight: "800", marginBottom: spacing(2) }}>
        {step + 1} / {CARDS.length}
      </Text>
      <Card>
        <Text style={[typography.screenTitle, { color: colors.ink }]}>{c.title}</Text>
        <Text style={{ color: colors.inkSoft, marginTop: spacing(1.5), fontSize: 15 }}>{c.body}</Text>
      </Card>

      {last ? (
        <>
          <Button title="Ücretsiz başla" onPress={() => finish("/")} />
          <Button title="Aile Paketi’ni gör" variant="ghost" onPress={() => finish("/paywall")} />
        </>
      ) : (
        <>
          <Button title="İleri" onPress={() => setStep(step + 1)} />
          <Button title="Geç" variant="link" onPress={() => finish("/")} />
        </>
      )}
    </ScrollView>
  );
}
