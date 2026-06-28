import { ScrollView, Text } from "react-native";
import { BRAND } from "@/config/brand";
import { colors, spacing } from "@/theme";

export default function Terms() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2.5) }}>
      <Text style={styles.h}>Kullanım Şartları</Text>
      <Text style={styles.p}>
        {BRAND.appName} bir kişisel finans takip aracıdır; yatırım, hukuk veya vergi
        danışmanlığı sunmaz. Uygulamadaki faiz ve asgari ödeme hesapları tahminîdir ve
        bankanızın resmi ekstresiyle farklılık gösterebilir.
      </Text>
      <Text style={styles.p}>
        Girdiğiniz verilerin doğruluğundan siz sorumlusunuz. Hatırlatmalar yardımcı
        niteliktedir; ödeme yükümlülüklerinizin takibi nihai olarak size aittir.
      </Text>
      <Text style={styles.p}>
        Uygulamayı kullanarak bu şartları kabul etmiş olursunuz. Sorularınız için
        {" "}{BRAND.supportEmail}.
      </Text>
      <Text style={styles.note}>
        Bu metin yayın öncesi hukuk danışmanı tarafından son kez gözden geçirilecektir.
      </Text>
    </ScrollView>
  );
}

const styles = {
  h: { fontSize: 20, fontWeight: "800" as const, color: colors.ink, marginBottom: spacing(1.5) },
  p: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, marginBottom: spacing(1.5) },
  note: { color: colors.muted, fontSize: 13, marginTop: spacing(1), fontStyle: "italic" as const },
};
