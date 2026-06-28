import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { NotificationPrefs } from "@/lib/database.types";

const DEFAULTS: NotificationPrefs = {
  member_id: "",
  push_enabled: true,
  email_enabled: true,
  remind_7d: true,
  remind_3d: true,
  remind_1d: true,
  remind_due_day: true,
  remind_overdue: true,
  scope: "all",
  days_before: 1,
  weekly_digest: true,
  digest_weekday: 1,
};

const SCOPES: { value: NotificationPrefs["scope"]; label: string }[] = [
  { value: "own", label: "Sadece kendi kayıtlarım" },
  { value: "household", label: "Ortak/hane kayıtları" },
  { value: "all", label: "Tüm aile kayıtları" },
];

export default function Settings() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase
      .from("notification_prefs")
      .select("*")
      .eq("member_id", uid)
      .maybeSingle()
      .then(({ data }) => setPrefs(data ?? { ...DEFAULTS, member_id: uid }));
  }, [session?.user.id]);

  const update = async (patch: Partial<NotificationPrefs>) => {
    const uid = session!.user.id;
    const next = { ...prefs, ...patch, member_id: uid };
    setPrefs(next);
    await supabase.from("notification_prefs").upsert(next, { onConflict: "member_id" });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.h}>Bildirim kanalları</Text>
        <Row label="Push bildirimi" value={prefs.push_enabled} onChange={(v) => update({ push_enabled: v })} />
        <Row label="E-posta" value={prefs.email_enabled} onChange={(v) => update({ email_enabled: v })} />
        <Row label="Haftalık özet maili" value={prefs.weekly_digest} onChange={(v) => update({ weekly_digest: v })} />
      </Card>

      <Card>
        <Text style={styles.h}>Hatırlatma zamanları</Text>
        <Row label="7 gün önce" value={prefs.remind_7d} onChange={(v) => update({ remind_7d: v })} />
        <Row label="3 gün önce" value={prefs.remind_3d} onChange={(v) => update({ remind_3d: v })} />
        <Row label="1 gün önce" value={prefs.remind_1d} onChange={(v) => update({ remind_1d: v })} />
        <Row label="Son gün" value={prefs.remind_due_day} onChange={(v) => update({ remind_due_day: v })} />
        <Row label="Gecikirse ertesi gün" value={prefs.remind_overdue} onChange={(v) => update({ remind_overdue: v })} />
      </Card>

      <Card>
        <Text style={styles.h}>Kapsam</Text>
        {SCOPES.map((s) => (
          <Pressable key={s.value} style={styles.row} onPress={() => update({ scope: s.value })}>
            <Text style={{ color: colors.ink }}>{s.label}</Text>
            <View style={[styles.radio, prefs.scope === s.value && styles.radioOn]} />
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={styles.h}>Aile</Text>
        <Button title="Aileyi yönet / davet et" variant="ghost" onPress={() => router.push("/family")} />
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
    <View style={styles.row}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(1) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
};
