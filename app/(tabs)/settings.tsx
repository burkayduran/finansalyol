import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { registerPushToken } from "@/lib/push";
import { Button, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { NotificationPrefs } from "@/lib/database.types";

const DEFAULTS: NotificationPrefs = {
  member_id: "", push_enabled: true, email_enabled: true,
  remind_7d: true, remind_3d: true, remind_1d: true, remind_due_day: true, remind_overdue: true,
  scope: "all", days_before: 1, weekly_digest: true, digest_weekday: 1,
};
const SCOPES: { value: NotificationPrefs["scope"]; label: string }[] = [
  { value: "own", label: "Sadece kendi kayıtlarım" },
  { value: "household", label: "Ortak/hane kayıtları" },
  { value: "all", label: "Tüm aile kayıtları" },
];

export default function Settings() {
  const router = useRouter();
  const { session, householdId, signOut } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [pushStatus, setPushStatus] = useState<string>("bilinmiyor");
  const [counts, setCounts] = useState({ members: 0, persons: 0, invites: 0 });

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase.from("notification_prefs").select("*").eq("member_id", uid).maybeSingle()
      .then(({ data }) => setPrefs(data ?? { ...DEFAULTS, member_id: uid }));
    Notifications.getPermissionsAsync().then((p) => setPushStatus(p.granted ? "açık" : p.status));
  }, [session?.user.id]);

  useEffect(() => {
    if (!householdId) return;
    (async () => {
      const [m, p, i] = await Promise.all([
        supabase.from("household_members").select("id", { count: "exact", head: true }).eq("household_id", householdId),
        supabase.from("persons").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("is_archived", false),
        supabase.from("household_invites").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("status", "pending"),
      ]);
      setCounts({ members: m.count ?? 0, persons: p.count ?? 0, invites: i.count ?? 0 });
    })();
  }, [householdId]);

  const update = async (patch: Partial<NotificationPrefs>) => {
    const uid = session!.user.id;
    const next = { ...prefs, ...patch, member_id: uid };
    setPrefs(next);
    await supabase.from("notification_prefs").upsert(next, { onConflict: "member_id" });
  };

  const sendTest = async () => {
    const granted = await registerPushToken(session!.user.id);
    const perm = await Notifications.getPermissionsAsync();
    setPushStatus(perm.granted ? "açık" : perm.status);
    if (!perm.granted) return Alert.alert("İzin yok", "Bildirim izni kapalı görünüyor.");
    await Notifications.scheduleNotificationAsync({
      content: { title: "Test bildirimi", body: "Bildirimler çalışıyor." },
      trigger: null,
    });
    Alert.alert("Gönderildi", granted ? "Test bildirimi gönderildi." : "Test bildirimi gönderildi (cihaz token'ı yok).");
  };

  const exportData = async () => {
    if (!householdId) return;
    const [d, a, c, pay, per] = await Promise.all([
      supabase.from("debts").select("*").eq("household_id", householdId),
      supabase.from("assets").select("*").eq("household_id", householdId),
      supabase.from("cash_flows").select("*").eq("household_id", householdId),
      supabase.from("payments").select("*").eq("household_id", householdId),
      supabase.from("persons").select("*").eq("household_id", householdId),
    ]);
    const payload = { exported_at: new Date().toISOString(), debts: d.data, assets: a.data, cash_flows: c.data, payments: pay.data, persons: per.data };
    await Share.share({ message: JSON.stringify(payload, null, 2) });
  };

  const deleteAccount = () =>
    Alert.alert("Hesabı sil", "Bu işlem geri alınamaz. Devam etmek için destek ekibiyle iletişime geçilir; şimdilik oturumunuz kapatılacak.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış yap", style: "destructive", onPress: () => signOut() },
    ]);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.h}>Bildirimler</Text>
        <Row label="Push bildirimi" value={prefs.push_enabled} onChange={(v) => update({ push_enabled: v })} />
        <Row label="E-posta" value={prefs.email_enabled} onChange={(v) => update({ email_enabled: v })} />
        <Row label="Haftalık özet" value={prefs.weekly_digest} onChange={(v) => update({ weekly_digest: v })} />
        <Text style={styles.sub}>Hatırlatma zamanları</Text>
        <Row label="7 gün önce" value={prefs.remind_7d} onChange={(v) => update({ remind_7d: v })} />
        <Row label="3 gün önce" value={prefs.remind_3d} onChange={(v) => update({ remind_3d: v })} />
        <Row label="1 gün önce" value={prefs.remind_1d} onChange={(v) => update({ remind_1d: v })} />
        <Row label="Son gün" value={prefs.remind_due_day} onChange={(v) => update({ remind_due_day: v })} />
        <Row label="Gecikirse ertesi gün" value={prefs.remind_overdue} onChange={(v) => update({ remind_overdue: v })} />
        <View style={styles.line}><Text style={{ color: colors.inkSoft }}>Bildirim durumu</Text><Text style={{ color: colors.ink, fontWeight: "600" }}>Push izni: {pushStatus}</Text></View>
        <Button title="Test bildirimi gönder" variant="ghost" onPress={sendTest} />
      </Card>

      <Card>
        <Text style={styles.h}>Bildirim kapsamı</Text>
        {SCOPES.map((s) => (
          <Pressable key={s.value} style={styles.line} onPress={() => update({ scope: s.value })}>
            <Text style={{ color: colors.ink }}>{s.label}</Text>
            <View style={[styles.radio, prefs.scope === s.value && styles.radioOn]} />
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={styles.h}>Aile ve paylaşım</Text>
        <View style={styles.line}><Text style={{ color: colors.inkSoft }}>Hane üyeleri</Text><Text style={{ color: colors.ink, fontWeight: "600" }}>{counts.members} kullanıcı</Text></View>
        <View style={styles.line}><Text style={{ color: colors.inkSoft }}>Takip edilen kişiler</Text><Text style={{ color: colors.ink, fontWeight: "600" }}>{counts.persons} kişi</Text></View>
        <View style={styles.line}><Text style={{ color: colors.inkSoft }}>Bekleyen davetler</Text><Text style={{ color: colors.ink, fontWeight: "600" }}>{counts.invites} davet</Text></View>
        <Button title="Aileyi yönet / davet et" variant="ghost" onPress={() => router.push("/family")} />
      </Card>

      <Card>
        <Text style={styles.h}>Veri ve güvenlik</Text>
        <Button title="Verileri dışa aktar" variant="ghost" onPress={exportData} />
        <Button title="Gizlilik metni" variant="ghost" onPress={() => Alert.alert("Gizlilik", "Verileriniz yalnızca hanenizle paylaşılır ve hesabınıza bağlı olarak saklanır. Tam metin yakında uygulamaya eklenecek.")} />
        <Button title="Hesabı sil" variant="link" onPress={deleteAccount} />
      </Card>

      <Card>
        <Text style={styles.h}>Görünüm ve tercihler</Text>
        <Text style={{ color: colors.muted }}>Para birimi, tema ve başlangıç ekranı yakında.</Text>
      </Card>

      <Card>
        <Text style={styles.h}>Destek</Text>
        <View style={styles.line}><Text style={{ color: colors.inkSoft }}>Uygulama sürümü</Text><Text style={{ color: colors.ink }}>{version}</Text></View>
        <Button title="Geri bildirim gönder" variant="ghost" onPress={() => Share.share({ message: "Finansal Yol geri bildirim: " })} />
      </Card>

      <Card>
        <Text style={styles.h}>Hesap</Text>
        <Text style={{ color: colors.inkSoft }}>{session?.user.email}</Text>
        <Button title="Çıkış yap" variant="link" onPress={signOut} />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.line}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  sub: { fontSize: 13, fontWeight: "700" as const, color: colors.muted, marginTop: spacing(1) },
  line: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(1) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
};
