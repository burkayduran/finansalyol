import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { track } from "@/lib/analytics";
import { handleSaveError } from "@/lib/errors";
import { CONSULT_PRODUCT_NAME, CONSULT_PRICE, CONSULT_LAUNCH_PRICE } from "@/core/plan";
import { colors, spacing, typography } from "@/theme";

const INCLUDES = [
  "45–60 dk online görüşme",
  "Borç ve ödeme önceliklendirme analizi",
  "Aylık nakit akışı değerlendirmesi",
  "Faiz yükü azaltma önerileri",
  "Yapılandırma / vade uzatma senaryoları",
  "Kişiye özel aksiyon planı",
  "PDF özet rapor",
];

export default function Consult() {
  const router = useRouter();
  const { session, householdId } = useSession();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      return Alert.alert("Eksik", "Ad soyad ve telefon gerekli.");
    }
    setSaving(true);
    const { error } = await supabase.from("consult_requests").insert({
      user_id: session?.user.id ?? null,
      household_id: householdId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      preferred_time: time.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (handleSaveError("consult-request", error, "Talep gönderilemedi. Lütfen tekrar dene.")) return;
    track("consult_requested");
    Alert.alert(
      "Talebini aldık",
      "Görüşme saati ve ödeme bilgisi için seninle iletişime geçeceğiz.",
      [{ text: "Tamam", onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink }]}>{CONSULT_PRODUCT_NAME}</Text>
        <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>
          Borç azaltma, bütçe ve nakit akışı planlama görüşmesi.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: spacing(1.5) }}>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 20 }}>₺{CONSULT_LAUNCH_PRICE}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, textDecorationLine: "line-through" }}>₺{CONSULT_PRICE}</Text>
          <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>lansmana özel</Text>
        </View>
        <View style={{ marginTop: spacing(1.5) }}>
          {INCLUDES.map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingVertical: 3 }}>
              <Text style={{ color: colors.asset, fontWeight: "800" }}>✓</Text>
              <Text style={{ color: colors.ink, flex: 1 }}>{i}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink, marginBottom: spacing(1) }]}>Görüşme talebi</Text>
        <Field label="Ad soyad" value={fullName} onChangeText={setFullName} placeholder="Adın soyadın" />
        <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05xx xxx xx xx" />
        <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="mail@ornek.com" />
        <Field label="Uygun gün/saat" value={time} onChangeText={setTime} placeholder="örn. hafta içi akşam" />
        <Field label="Ek not (ops.)" value={note} onChangeText={setNote} placeholder="Kısaca durumun" />
        <Button title="Plan görüşmesi al" onPress={submit} loading={saving} />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing(1) }}>
          Talebini aldıktan sonra ödeme bilgisi (havale / ödeme linki) ile iletişime geçeriz. Bu hizmet yatırım danışmanlığı değildir.
        </Text>
      </Card>
    </ScrollView>
  );
}
