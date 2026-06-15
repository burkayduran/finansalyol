import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { NotificationPrefs } from "@/lib/database.types";

const DEFAULTS: NotificationPrefs = {
  member_id: "",
  push_enabled: true,
  email_enabled: true,
  days_before: 1,
  weekly_digest: true,
  digest_weekday: 1,
};

export default function Settings() {
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
        <Text style={styles.h}>Hatırlatma kanalları</Text>
        <Row
          label="Push bildirimleri"
          value={prefs.push_enabled}
          onChange={(v) => update({ push_enabled: v })}
        />
        <Row
          label="E-posta bildirimleri"
          value={prefs.email_enabled}
          onChange={(v) => update({ email_enabled: v })}
        />
        <Row
          label="Haftalık özet maili"
          value={prefs.weekly_digest}
          onChange={(v) => update({ weekly_digest: v })}
        />
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: spacing(1) }}>
          Ödeme gününden {prefs.days_before} gün önce ve son gün hatırlatırız.
        </Text>
      </Card>

      <Card>
        <Text style={styles.h}>Hesap</Text>
        <Text style={{ color: colors.inkSoft }}>{session?.user.email}</Text>
        <Button title="Çıkış yap" variant="link" onPress={signOut} />
      </Card>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
  },
};
