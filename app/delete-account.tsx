import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { reset as analyticsReset } from "@/lib/analytics";
import { Button, Card } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

interface PersonOpt { id: string; name: string; memberId: string }

export default function DeleteAccount() {
  const router = useRouter();
  const { session, householdId, signOut } = useSession();
  const [isOwner, setIsOwner] = useState(false);
  const [otherMemberCount, setOtherMemberCount] = useState(0);
  const [candidates, setCandidates] = useState<PersonOpt[]>([]);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) return;
    if (householdId) {
      const { data: me } = await supabase.from("household_members").select("role").eq("household_id", householdId).eq("member_id", uid).maybeSingle();
      setIsOwner(me?.role === "owner");
      const { data: members } = await supabase.from("household_members").select("member_id").eq("household_id", householdId);
      const others = (members ?? []).filter((m: any) => m.member_id !== uid);
      setOtherMemberCount(others.length);
      const otherIds = new Set(others.map((m: any) => m.member_id));
      const { data: persons } = await supabase.from("persons").select("id, display_name, linked_member_id").eq("household_id", householdId).eq("is_archived", false);
      setCandidates(
        (persons ?? [])
          .filter((p: any) => p.linked_member_id && p.linked_member_id !== uid && otherIds.has(p.linked_member_id))
          .map((p: any) => ({ id: p.id, name: p.display_name, memberId: p.linked_member_id }))
      );
    }
    const { data: req } = await supabase
      .from("account_deletion_requests").select("id, status").eq("user_id", uid).in("status", ["pending", "processing"]).maybeSingle();
    setPending(req ?? null);
  }, [session?.user.id, householdId]);

  useEffect(() => { load(); }, [load]);

  const ownerWithOthers = isOwner && otherMemberCount > 0;

  const doDelete = async () => {
    const uid = session?.user.id;
    if (!uid) return;
    if (ownerWithOthers && !replacement) {
      return Alert.alert("Yeni sahip gerekli", "Hesabını silmeden önce hane sahipliğini devralacak bir üye seç.");
    }
    setBusy(true);
    try {
      // Talebi oluştur/güncelle (idempotent: aktif talep varsa güncelle).
      if (pending) {
        await supabase.from("account_deletion_requests").update({ replacement_owner_id: ownerWithOthers ? replacement : null }).eq("id", pending.id);
      } else {
        await supabase.from("account_deletion_requests").insert({
          user_id: uid, requested_by: uid, household_id: householdId,
          replacement_owner_id: ownerWithOthers ? replacement : null, status: "pending",
        });
      }
      const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
      if (error || !(data as any)?.ok) {
        const code = (data as any)?.error;
        if (code === "replacement_owner_required") {
          await load();
          return Alert.alert("Yeni sahip gerekli", "Hane sahipliğini devralacak bir üye seç ve tekrar dene.");
        }
        await load();
        return Alert.alert("Olmadı", "Silme tamamlanamadı. Daha sonra tekrar deneyebilirsin.");
      }
      // Tamamlandı → analytics temizle + oturum kapat (bekçi sign-in'e yönlendirir).
      analyticsReset();
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      "Hesabımı kalıcı sil",
      "Bu işlem geri alınamaz. Hesabın ve sana ait hane verilerin kalıcı olarak silinir.",
      [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: doDelete }]
    );
  };

  const cancelPending = async () => {
    if (!pending) return;
    await supabase.from("account_deletion_requests").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", pending.id);
    await load();
    Alert.alert("İptal edildi", "Silme talebin iptal edildi.");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={[typography.cardTitle, { color: colors.ink }]}>Hesabımı sil</Text>
        <Text style={{ color: colors.inkSoft, marginTop: spacing(1) }}>
          Silme işlemi geri alınamaz. Silinecekler: profilin, bildirim tercihlerin, push kayıtların,
          aboneliğe dair entitlement kaydın, hukuki kabul kayıtların ve sana ait finansal veriler.
        </Text>
        <Text style={{ color: colors.danger, marginTop: spacing(1), fontWeight: "700" }}>
          Not: Hesabını silmek, mağaza (App Store / Google Play) aboneliğini otomatik iptal etmez.
          Aboneliğini ilgili mağazadan ayrıca iptal etmelisin.
        </Text>
      </Card>

      {ownerWithOthers && (
        <Card>
          <Text style={[typography.cardTitle, { color: colors.ink }]}>Hane sahipliğini devret</Text>
          <Text style={{ color: colors.inkSoft, marginTop: spacing(1), marginBottom: spacing(1) }}>
            Hanede başka üyeler var. Silmeden önce sahipliği devralacak bir üye seç.
          </Text>
          {candidates.length === 0 ? (
            <Text style={{ color: colors.muted }}>Devredilebilecek aktif üye bulunamadı.</Text>
          ) : (
            candidates.map((c) => (
              <Pressable key={c.id} onPress={() => setReplacement(c.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: replacement === c.id ? colors.accent : colors.muted, backgroundColor: replacement === c.id ? colors.accent : "transparent" }} />
                <Text style={{ color: colors.ink }}>{c.name}</Text>
              </Pressable>
            ))
          )}
        </Card>
      )}

      {pending && (
        <Card>
          <Text style={{ color: colors.inkSoft }}>
            {pending.status === "processing" ? "Silme işlemin başladı; iptal edilemez." : "Bekleyen bir silme talebin var."}
          </Text>
          {pending.status === "pending" && <Button title="Talebi iptal et" variant="ghost" onPress={cancelPending} />}
        </Card>
      )}

      <Button title="Hesabımı kalıcı sil" danger variant="link" onPress={confirm} loading={busy} />
    </ScrollView>
  );
}
