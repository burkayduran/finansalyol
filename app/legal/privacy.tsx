import { ScrollView, Text } from "react-native";
import { BRAND } from "@/config/brand";
import { colors, spacing } from "@/theme";

export default function Privacy() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2.5) }}>
      <Text style={styles.h}>Gizlilik Politikası</Text>
      <Text style={styles.p}>
        {BRAND.appName}, ailenizin finansal kayıtlarını yönetmenize yardımcı olur. Girdiğiniz
        borç, varlık, gelir-gider ve ödeme verileri yalnızca üyesi olduğunuz hane ile
        paylaşılır ve hesabınıza bağlı olarak güvenli altyapıda (Supabase) saklanır.
      </Text>
      <Text style={styles.p}>
        Verileriniz reklam amacıyla üçüncü taraflarla paylaşılmaz. Bildirim göndermek için
        cihaz bildirim jetonunuz; e-posta hatırlatması için e-posta adresiniz kullanılır.
      </Text>
      <Text style={styles.p}>
        İstediğiniz zaman Hesabım › Veri ve güvenlik bölümünden verilerinizi dışa aktarabilir
        veya hesap silme talebi oluşturabilirsiniz.
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
