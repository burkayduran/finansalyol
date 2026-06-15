import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useHousehold } from "@/hooks/useHousehold";
import { Button, Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { colors, spacing } from "@/theme";

export default function Dashboard() {
  const router = useRouter();
  const data = useHousehold();
  const [refreshing, setRefreshing] = useState(false);

  // Sekmeye her dönüşte tazele (yeni borç/ödeme yansısın).
  useFocusEffect(useCallback(() => { data.reload(); }, [data.reload]));

  const onRefresh = async () => {
    setRefreshing(true);
    await data.reload();
    setRefreshing(false);
  };

  const empty = data.debts.length === 0 && data.assets.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing(2) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Net durum kartı — panonun kalbi */}
      <Card style={{ backgroundColor: colors.primary }}>
        <Text style={{ color: "#cbeae6", fontSize: 14 }}>Net durum</Text>
        <Text style={{ color: "#fff", fontSize: 34, fontWeight: "800", marginVertical: 4 }}>
          {formatTRY(data.net)}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing(1) }}>
          <View>
            <Text style={{ color: "#cbeae6", fontSize: 13 }}>Toplam borç</Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              {formatTRY(data.totalDebt)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#cbeae6", fontSize: 13 }}>Toplam birikim</Text>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              {formatTRY(data.totalAsset)}
            </Text>
          </View>
        </View>
      </Card>

      {empty && (
        <Card>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>
            İlk hesabını ekle
          </Text>
          <Text style={{ color: colors.inkSoft, marginVertical: spacing(1) }}>
            Bir borç ya da birikim ekleyince pano canlanır. Sonra aileni davet edebilirsin.
          </Text>
          <Button title="Borç ekle" onPress={() => router.push("/add-debt")} />
          <Button title="Birikim ekle" variant="ghost" onPress={() => router.push("/add-asset")} />
        </Card>
      )}

      {/* Kişi kırılımı */}
      {data.byPerson.length > 0 && (
        <Card>
          <Text style={styles.section}>Kim ne kadar borçlu</Text>
          {data.byPerson.map((b, i) => (
            <View key={b.person?.id ?? `orphan-${i}`} style={styles.row}>
              <Text style={{ color: colors.ink }}>{b.person?.display_name ?? "Atanmamış"}</Text>
              <Text style={{ color: colors.debt, fontWeight: "700" }}>{formatTRY(b.totalDebt)}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Yaklaşan ödemeler */}
      {data.upcoming.length > 0 && (
        <Card>
          <Text style={styles.section}>Yaklaşan ödemeler</Text>
          {data.upcoming.map((u) => (
            <Link key={u.debt.id} href={{ pathname: "/debt/[id]", params: { id: u.debt.id } }} asChild>
              <Pressable style={styles.row}>
                <View>
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {u.debt.label ?? u.debt.bank}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {u.days === 0 ? "Bugün son gün" : `${u.days} gün sonra`}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  {u.minimum > 0 ? formatTRY(u.minimum) : formatTRY(Number(u.debt.balance))}
                </Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      )}

      {!empty && (
        <View style={{ marginTop: spacing(1) }}>
          <Button title="+ Borç ekle" onPress={() => router.push("/add-debt")} />
          <Button title="+ Birikim ekle" variant="ghost" onPress={() => router.push("/add-asset")} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = {
  section: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
};
