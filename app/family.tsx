import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { track } from "@/lib/analytics";
import { colors, spacing } from "@/theme";
import type { Person } from "@/lib/database.types";

interface Invite {
  id: string;
  email: string;
  code: string;
  status: string;
}

export default function Family() {
  const { householdId } = useSession();
  const [persons, setPersons] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newPerson, setNewPerson] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    if (!householdId) return;
    const [p, i] = await Promise.all([
      supabase.from("persons").select("*").eq("household_id", householdId).eq("is_archived", false),
      supabase
        .from("household_invites")
        .select("id, email, code, status")
        .eq("household_id", householdId)
        .eq("status", "pending"),
    ]);
    setPersons(p.data ?? []);
    setInvites((i.data as Invite[]) ?? []);
  }, [householdId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPerson = async () => {
    if (!newPerson.trim()) return;
    const { error } = await supabase
      .from("persons")
      .insert({ household_id: householdId!, display_name: newPerson.trim() });
    if (error) return Alert.alert("Olmadı", error.message);
    track("person_added");
    setNewPerson("");
    load();
  };

  const saveRename = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from("persons").update({ display_name: editName.trim() }).eq("id", id);
    setEditingId(null);
    setEditName("");
    load();
  };

  const archivePerson = (p: Person) =>
    Alert.alert("Kişiyi arşivle", `${p.display_name} listeden gizlensin mi? Kayıtları korunur.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Arşivle",
        style: "destructive",
        onPress: async () => {
          await supabase.from("persons").update({ is_archived: true }).eq("id", p.id);
          load();
        },
      },
    ]);

  const createInvite = async () => {
    if (!inviteEmail.trim()) return Alert.alert("Eksik", "Davet için e-posta gir.");
    const { data, error } = await supabase
      .from("household_invites")
      .insert({ household_id: householdId!, email: inviteEmail.trim(), invited_by: (await supabase.auth.getUser()).data.user!.id })
      .select("code")
      .single();
    if (error) return Alert.alert("Olmadı", error.message);
    track("invite_sent");
    setInviteEmail("");
    load();
    Share.share({
      message: `Ailemizin borç-takip hanesine katıl. Davet kodu: ${data.code}`,
    });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={styles.h}>Kişiler</Text>
        <Text style={{ color: colors.inkSoft, marginBottom: spacing(1) }}>
          Borç bağlanan herkes (anne, baba…). Uygulamayı kullanmak zorunda değiller.
        </Text>
        {persons.map((p) =>
          editingId === p.id ? (
            <View key={p.id} style={{ paddingVertical: spacing(1) }}>
              <Field label="Ad" value={editName} onChangeText={setEditName} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable onPress={() => saveRename(p.id)}><Text style={styles.action}>Kaydet</Text></Pressable>
                <Pressable onPress={() => setEditingId(null)}><Text style={{ color: colors.muted }}>Vazgeç</Text></Pressable>
              </View>
            </View>
          ) : (
            <View key={p.id} style={styles.row}>
              <Text style={{ color: colors.ink }}>
                {p.display_name}
                {p.linked_member_id ? <Text style={{ color: colors.ok, fontSize: 12 }}>  üye</Text> : null}
              </Text>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable onPress={() => { setEditingId(p.id); setEditName(p.display_name); }}>
                  <Text style={styles.action}>Düzenle</Text>
                </Pressable>
                <Pressable onPress={() => archivePerson(p)}>
                  <Text style={{ color: colors.muted }}>Arşivle</Text>
                </Pressable>
              </View>
            </View>
          )
        )}
        <Field label="Yeni kişi" value={newPerson} onChangeText={setNewPerson} placeholder="örn. Babam" />
        <Button title="Kişi ekle" variant="ghost" onPress={addPerson} />
      </Card>

      <Card>
        <Text style={styles.h}>Aileni davet et</Text>
        <Text style={{ color: colors.inkSoft, marginBottom: spacing(1) }}>
          Davet edilen kişi giriş yapıp kodu girince aynı panoyu görür.
        </Text>
        {invites.map((inv) => (
          <View key={inv.id} style={styles.row}>
            <Text style={{ color: colors.ink }}>{inv.email}</Text>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{inv.code}</Text>
          </View>
        ))}
        <Field
          label="Davet e-postası"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="esim@eposta.com"
        />
        <Button title="Davet oluştur ve paylaş" onPress={createInvite} />
      </Card>
    </ScrollView>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  action: { color: colors.primary, fontWeight: "600" as const },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
};
