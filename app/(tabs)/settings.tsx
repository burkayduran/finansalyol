import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { registerPushToken } from "@/lib/push";
import { toISODateLocal } from "@/core/dates";
import { track } from "@/lib/analytics";
import { BRAND } from "@/config/brand";
import { useEntitlement } from "@/config/entitlements";
import { FEATURES } from "@/config/features";
import { Button, Card, Field } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { NotificationPrefs } from "@/lib/database.types";

const DEFAULTS: NotificationPrefs = {
  member_id: "", push_enabled: true, email_enabled: true,
  remind_7d: true, remind_3d: true, remind_1d: true, remind_due_day: true, remind_overdue: true,
  scope: "all", days_before: 1, weekly_digest: true, digest_weekday: 1,
  hide_amount_in_notifications: true,
};
const SCOPES: { value: NotificationPrefs["scope"]; label: string }[] = [
  { value: "own", label: "Sadece kendi kayıtlarım" },
  { value: "household", label: "Ortak/hane kayıtları" },
  { value: "all", label: "Tüm aile kayıtları" },
];

export default function Settings() {
  const router = useRouter();
  const { features, plan, isPremium, setLocalPlan } = useEntitlement();
  const { session, householdId, signOut } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [pushStatus, setPushStatus] = useState("bilinmiyor");
  const [counts, setCounts] = useState({ members: 0, persons: 0, invites: 0 });
  const [profile, setProfile] = useState<{ full_name: string; email: string }>({ full_name: "", email: "" });
  const [householdName, setHouseholdName] = useState("");
  const [deletionAt, setDeletionAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | "profile" | "household">(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    supabase.from("notification_prefs").select("*").eq("member_id", uid).maybeSingle()
      .then(({ data }) => setPrefs(data ?? { ...DEFAULTS, member_id: uid }));
    supabase.from("profiles").select("full_name, email").eq("id", uid).maybeSingle()
      .then(({ data }) => setProfile({ full_name: data?.full_name ?? "", email: data?.email ?? session?.user.email ?? "" }));
    Notifications.getPermissionsAsync().then((p) => setPushStatus(p.granted ? "İzin verildi" : p.status === "denied" ? "Kapalı" : "İzin bekliyor"));
    supabase.from("account_deletion_requests").select("created_at").eq("user_id", uid).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDeletionAt(data?.created_at ?? null));
  }, [session?.user.id]);

  useEffect(() => {
    if (!householdId) return;
    (async () => {
      const [m, p, i, h] = await Promise.all([
        supabase.from("household_members").select("id", { count: "exact", head: true }).eq("household_id", householdId),
        supabase.from("persons").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("is_archived", false),
        supabase.from("household_invites").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("status", "pending"),
        supabase.from("households").select("name").eq("id", householdId).maybeSingle(),
      ]);
      setCounts({ members: m.count ?? 0, persons: p.count ?? 0, invites: i.count ?? 0 });
      setHouseholdName(h.data?.name ?? "");
    })();
  }, [householdId]);

  const update = async (patch: Partial<NotificationPrefs>) => {
    const uid = session!.user.id;
    const next = { ...prefs, ...patch, member_id: uid };
    setPrefs(next);
    await supabase.from("notification_prefs").upsert(next, { onConflict: "member_id" });
    if (patch.push_enabled || patch.email_enabled) track("notification_enabled", { push_enabled: next.push_enabled, email_enabled: next.email_enabled });
  };

  const saveEdit = async () => {
    if (editing === "profile") {
      await supabase.from("profiles").update({ full_name: draftName.trim() }).eq("id", session!.user.id);
      setProfile((p) => ({ ...p, full_name: draftName.trim() }));
    } else if (editing === "household" && householdId) {
      await supabase.from("households").update({ name: draftName.trim() }).eq("id", householdId);
      setHouseholdName(draftName.trim());
    }
    setEditing(null);
  };

  const sendTest = async () => {
    await registerPushToken(session!.user.id);
    const perm = await Notifications.getPermissionsAsync();
    setPushStatus(perm.granted ? "İzin verildi" : "Kapalı");
    if (!perm.granted) return Alert.alert("İzin yok", "Bildirim izni kapalı görünüyor.");
    await Notifications.scheduleNotificationAsync({ content: { title: "Test bildirimi", body: "Bildirimler çalışıyor." }, trigger: null });
    Alert.alert("Gönderildi", "Test bildirimi gönderildi.");
  };

  const exportData = async () => {
    if (!householdId) return;
    track("export_data_clicked");
    const [d, a, c, pay, per] = await Promise.all([
      supabase.from("debts").select("*").eq("household_id", householdId),
      supabase.from("assets").select("*").eq("household_id", householdId),
      supabase.from("cash_flows").select("*").eq("household_id", householdId),
      supabase.from("payments").select("*").eq("household_id", householdId),
      supabase.from("persons").select("*").eq("household_id", householdId),
    ]);
    const payload = { app: BRAND.appName, exported_at: new Date().toISOString(), debts: d.data, assets: a.data, cash_flows: c.data, payments: pay.data, persons: per.data };
    await Share.share({ message: JSON.stringify(payload, null, 2) });
  };

  const requestDeletion = () =>
    Alert.alert("Hesabımı sil", "Bu işlem geri alınamaz. Talebin alınır ve hesabın ile hane verilerin 30 gün içinde işleme alınıp silinir. Devam edilsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Talep oluştur",
        style: "destructive",
        onPress: async () => {
          const { data, error } = await supabase.from("account_deletion_requests")
            .insert({ user_id: session!.user.id, household_id: householdId }).select("created_at").single();
          if (error) return Alert.alert("Olmadı", "Talep oluşturulamadı. Lütfen tekrar dene.");
          setDeletionAt(data?.created_at ?? new Date().toISOString());
          track("delete_request_created");
          Alert.alert("Talebin alındı", "Hesap silme talebin kaydedildi. 30 gün içinde işleme alınacak.");
        },
      },
    ]);

  const [smoke, setSmoke] = useState<string>("");
  const runSmoke = async () => {
    const lines: string[] = [];
    const step = (name: string, ok: boolean, extra = "") => lines.push(`${name}: ${ok ? "OK" : "HATA"}${extra ? ` (${extra})` : ""}`);
    try {
      const { data: u } = await supabase.auth.getUser();
      step("User", !!u.user);
      step("Household", !!householdId, householdId ?? "yok");
      if (householdId) {
        const mem = await supabase.from("household_members").select("id").eq("household_id", householdId).eq("member_id", u.user!.id).maybeSingle();
        step("Membership", !!mem.data);
        const ppl = await supabase.from("persons").select("id").eq("household_id", householdId).limit(1);
        step("Read people", !ppl.error);
        const ins = await supabase.from("cash_flows").insert({
          household_id: householdId, owner_type: "household", direction: "expense",
          category: "other", label: "__smoke_test__", amount: 1, recurrence: "one_time",
          occurred_on: toISODateLocal(new Date()),
        }).select("id").single();
        step("Insert test", !ins.error, ins.error?.message);
        if (ins.data) {
          const del = await supabase.from("cash_flows").delete().eq("id", ins.data.id);
          step("Delete test", !del.error, del.error?.message);
        }
      }
    } catch (e) {
      lines.push(`İstisna: ${(e as { message?: string })?.message ?? "bilinmiyor"}`);
    }
    setSmoke(lines.join("\n"));
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.h}>Profil</Text>
        {editing === "profile" ? (
          <>
            <Field label="Ad Soyad" value={draftName} onChangeText={setDraftName} />
            <Button title="Kaydet" variant="neutral" onPress={saveEdit} />
          </>
        ) : (
          <>
            <Line label="Ad Soyad" value={profile.full_name || "—"} />
            <Line label="E-posta" value={profile.email} />
            <Line label="Hane adı" value={householdName || "—"} />
            <View style={{ flexDirection: "row", gap: 16, marginTop: spacing(0.5) }}>
              <Pressable onPress={() => { setEditing("profile"); setDraftName(profile.full_name); }}><Text style={styles.action}>Profili düzenle</Text></Pressable>
              <Pressable onPress={() => { setEditing("household"); setDraftName(householdName); }}><Text style={styles.action}>Hane adını düzenle</Text></Pressable>
            </View>
          </>
        )}
        {editing === "household" && (
          <>
            <Field label="Hane adı" value={draftName} onChangeText={setDraftName} />
            <Button title="Kaydet" variant="neutral" onPress={saveEdit} />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Bildirimler</Text>
        <Row label="Push bildirimi" value={prefs.push_enabled} onChange={(v) => update({ push_enabled: v })} />
        {FEATURES.emailReminders ? (
          <>
            <Row label="E-posta (mail ile ödeme uyarısı)" value={prefs.email_enabled} onChange={(v) => {
              if (v && !features.canUseEmailReminder) return router.push("/paywall?feature=email");
              update({ email_enabled: v });
            }} />
            <Row label="Haftalık özet" value={prefs.weekly_digest} onChange={(v) => {
              if (v && !features.canUseEmailReminder) return router.push("/paywall?feature=email");
              update({ weekly_digest: v });
            }} />
          </>
        ) : (
          <View style={styles.line}>
            <Text style={{ color: colors.inkSoft }}>E-posta bildirimi</Text>
            <Text style={{ color: colors.muted, fontStyle: "italic" }}>Yakında</Text>
          </View>
        )}
        <Text style={styles.sub}>Hatırlatma zamanları</Text>
        <Row label="7 gün önce" value={prefs.remind_7d} onChange={(v) => update({ remind_7d: v })} />
        <Row label="3 gün önce" value={prefs.remind_3d} onChange={(v) => update({ remind_3d: v })} />
        <Row label="1 gün önce" value={prefs.remind_1d} onChange={(v) => update({ remind_1d: v })} />
        <Row label="Son gün" value={prefs.remind_due_day} onChange={(v) => update({ remind_due_day: v })} />
        <Row label="Gecikirse ertesi gün" value={prefs.remind_overdue} onChange={(v) => update({ remind_overdue: v })} />
        <Row label="Bildirimde tutarı gizle" value={prefs.hide_amount_in_notifications} onChange={(v) => update({ hide_amount_in_notifications: v })} />
        <Line label="Push izin durumu" value={pushStatus} />
        <Button title="Test bildirimi gönder" variant="ghost" onPress={sendTest} />
        <Text style={styles.sub}>Bildirim kapsamı</Text>
        {SCOPES.map((s) => (
          <Pressable key={s.value} style={styles.line} onPress={() => update({ scope: s.value })}>
            <Text style={{ color: colors.ink }}>{s.label}</Text>
            <View style={[styles.radio, prefs.scope === s.value && styles.radioOn]} />
          </Pressable>
        ))}
      </Card>

      <Card>
        <Text style={styles.h}>Aile Paketi</Text>
        <Line label="Mevcut plan" value={isPremium ? plan : "Ücretsiz"} />
        <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: spacing(1) }}>
          Aile, nakit akışı, varlık takibi ve mail uyarıları Aile Paketi’ne özeldir.
        </Text>
        <Button
          title={isPremium ? "Paketi görüntüle" : "Aile Paketi’ni başlat"}
          variant={isPremium ? "ghost" : "primary"}
          onPress={() => router.push("/paywall")}
        />
        {__DEV__ && (
          <Button
            title={isPremium ? "Premium'u kapat (dev)" : "Premium simüle et (dev)"}
            variant="link"
            onPress={() => setLocalPlan(isPremium ? null : "family_4")}
          />
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Borç Azaltma Planı</Text>
        <Text style={{ color: colors.inkSoft, marginBottom: spacing(1) }}>
          Uzmanla birebir görüşme — borç azaltma, bütçe ve nakit akışı planlaması.
        </Text>
        <Button title="Plan görüşmesi al" variant="ghost" onPress={() => router.push("/consult")} />
      </Card>

      <Card>
        <Text style={styles.h}>Aile ve paylaşım</Text>
        <Line label="Hane üyeleri" value={`${counts.members} kullanıcı`} />
        <Line label="Takip edilen kişiler" value={`${counts.persons} kişi`} />
        <Line label="Bekleyen davetler" value={`${counts.invites} davet`} />
        <Button title="Aileyi yönet / davet et" variant="ghost" onPress={() => router.push("/family")} />
      </Card>

      <Card>
        <Text style={styles.h}>Veri ve güvenlik</Text>
        <Text style={{ color: colors.inkSoft, marginBottom: spacing(1) }}>
          Tüm borç, varlık, ödeme ve aile kayıtlarını dosya olarak indir.
        </Text>
        <Button title="Verilerimi indir" variant="ghost" onPress={exportData} />
        {deletionAt ? (
          <Text style={{ color: colors.danger, marginVertical: spacing(1) }}>
            Silme talebin alındı — {deletionAt.slice(0, 10)} (30 gün içinde işlenir)
          </Text>
        ) : (
          <Button title="Hesabımı sil" variant="link" danger onPress={requestDeletion} />
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Yasal metinler</Text>
        <LegalRow label="Gizlilik Politikası" onOpen={() => router.push("/legal/privacy")} onWeb={() => Linking.openURL(BRAND.urls.privacy)} />
        <LegalRow label="KVKK Aydınlatma Metni" onOpen={() => router.push("/legal/kvkk")} onWeb={() => Linking.openURL(BRAND.urls.kvkk)} />
        <LegalRow label="Kullanım Şartları" onOpen={() => router.push("/legal/terms")} onWeb={() => Linking.openURL(BRAND.urls.terms)} />
      </Card>

      <Card>
        <Text style={styles.h}>Destek</Text>
        <NavRow label="Geri bildirim / hata bildir" onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(BRAND.appName + " geri bildirim")}`)} />
        <Line label="Destek e-postası" value={BRAND.supportEmail} />
      </Card>

      {typeof __DEV__ !== "undefined" && __DEV__ && (
        <Card>
          <Text style={styles.h}>Veri yazma testi (dev)</Text>
          <Button title="Testi çalıştır" variant="ghost" onPress={runSmoke} />
          {smoke ? <Text style={{ color: colors.inkSoft, fontFamily: "monospace" as const, marginTop: spacing(1) }}>{smoke}</Text> : null}
        </Card>
      )}

      <Card>
        <Text style={styles.h}>Uygulama bilgisi</Text>
        <Line label="Uygulama" value={BRAND.appName} />
        <Line label="Sürüm" value={version} />
        <Line label="Hesap" value={session?.user.email ?? "—"} />
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
function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={{ color: colors.inkSoft }}>{label}</Text>
      <Text style={{ color: colors.ink, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}
function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.line} onPress={onPress}>
      <Text style={{ color: colors.ink }}>{label}</Text>
      <Text style={{ color: colors.accent, fontWeight: "700" }}>›</Text>
    </Pressable>
  );
}
function LegalRow({ label, onOpen, onWeb }: { label: string; onOpen: () => void; onWeb: () => void }) {
  return (
    <View style={styles.line}>
      <Pressable onPress={onOpen} style={{ flex: 1 }}>
        <Text style={{ color: colors.ink }}>{label}</Text>
      </Pressable>
      <Pressable onPress={onWeb} hitSlop={8}>
        <Text style={{ color: colors.accent, fontWeight: "700" }}>tarayıcıda aç ↗</Text>
      </Pressable>
    </View>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  sub: { fontSize: 13, fontWeight: "700" as const, color: colors.inkSoft, marginTop: spacing(1) },
  action: { color: colors.primary, fontWeight: "600" as const },
  line: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: spacing(1) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
};
