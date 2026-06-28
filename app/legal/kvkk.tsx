import { ScrollView, Text } from "react-native";
import { BRAND } from "@/config/brand";
import { colors, spacing } from "@/theme";

export default function Kvkk() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2.5) }}>
      <Text style={styles.h}>KVKK Aydınlatma Metni</Text>
      <Text style={styles.p}>
        6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında {BRAND.appName}, veri
        sorumlusu olarak kişisel verilerinizi; hizmetin sunulması, ödeme hatırlatmaları ve
        hane içi paylaşım amaçlarıyla işler.
      </Text>
      <Text style={styles.p}>
        İşlenen veriler: kimlik (ad, e-posta), finansal kayıtlar (borç, varlık, ödeme) ve
        bildirim tercihleri. Verileriniz yalnızca bu amaçlarla ve mevzuatın gerektirdiği
        süre boyunca saklanır.
      </Text>
      <Text style={styles.p}>
        Kanunun 11. maddesi uyarınca verilerinize erişme, düzeltme, silme ve taşınabilirlik
        haklarına sahipsiniz. Talepleriniz için {BRAND.supportEmail} adresine yazabilirsiniz.
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
