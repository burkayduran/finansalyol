import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field } from "@/components/ui";
import { formatTRY, formatPercent, parseTRYInput } from "@/core/format";
import { daysUntilDue, formatShortDate, nextDueDate } from "@/core/dates";
import { mandatoryMinimum } from "@/core/minimum";
import { minimumTrap, avoidedInterestFromExtra, type TrapVerdict } from "@/core/interest";
import { colors, spacing } from "@/theme";
import type { Debt } from "@/lib/database.types";

const TRAP_TEXT: Record<TrapVerdict, string> = {
  shrinks: "Sadece asgarisini ödersen borç azalır ama kalan tutara faiz işler. Biraz fazlası daha hızlı bitirir.",
  barely_shrinks: "Sadece asgarisini ödersen kalan borca faiz işler; bu gidişle borç çok yavaş azalır.",
  not_shrinking: "Sadece asgarisini ödersen işleyen faiz ödediğini neredeyse götürür; borç pek azalmaz.",
  growing: "Sadece asgarisini ödersen işleyen faiz asgariden büyük; bu gidişle borç azalmaz, artar.",
};

export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { householdId } = useSession();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [tab, setTab] = useState<"ozet" | "icgoru">("ozet");
  const [payAmount, setPayAmount] = useState("");
  const [extraWhatIf, setExtraWhatIf] = useState("");

  const load = async () => {
    const { data } = await supabase.from("debts").select("*").eq("id", id).maybeSingle();
    setDebt(data);
  };
  useEffect(() => {
    load();
  }, [id]);

  if (!debt) {
    return (
      <View style={{ flex: 1, padding: spacing(3) }}>
        <Text style={{ color: colors.inkSoft }}>Yükleniyor…</Text>
      </View>
    );
  }

  const balance = Number(debt.balance);
  const insightInput = {
    kind: debt.kind,
    balance,
    cardLimit: debt.card_limit,
    installment: debt.installment,
    userMinimum: debt.user_minimum,
    userMonthlyRate: debt.user_monthly_rate,
  };
  const minimum = mandatoryMinimum(insightInput);
  const days = daysUntilDue(debt.due_day);
  const due = nextDueDate(debt.due_day);
  const trap = minimumTrap(insightInput);
  const extraVal = parseTRYInput(extraWhatIf) ?? 0;
  const avoided = extraVal > 0 ? avoidedInterestFromExtra(insightInput, extraVal) : 0;

  const logPayment = async () => {
    const amount = parseTRYInput(payAmount);
    if (amount == null || amount <= 0) return;
    const { error } = await supabase.from("payments").insert({
      household_id: householdId!,
      debt_id: debt.id,
      amount,
    });
    if (error) return Alert.alert("Olmadı", error.message);
    // Bakiyeyi düş (basit F1 davranışı).
    const newBalance = Math.max(0, balance - amount);
    await supabase.from("debts").update({ balance: newBalance }).eq("id", debt.id);
    setPayAmount("");
    load();
  };

  const remove = () =>
    Alert.alert("Borcu sil", "Bu borç ve ödemeleri silinecek. Emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await supabase.from("debts").delete().eq("id", debt.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Text style={{ color: colors.muted }}>{debt.bank}</Text>
        <Text style={{ fontSize: 30, fontWeight: "800", color: colors.ink }}>
          {formatTRY(balance)}
        </Text>
        <Text style={{ color: colors.inkSoft, marginTop: 4 }}>
          Son ödeme: {formatShortDate(due)} · {days === 0 ? "bugün" : `${days} gün`}
        </Text>
        {minimum > 0 && (
          <Text style={{ color: colors.inkSoft, marginTop: 2 }}>
            Bu ay asgari: <Text style={{ fontWeight: "700" }}>{formatTRY(minimum)}</Text>
          </Text>
        )}
      </Card>

      {/* Sekme: Özet / İçgörü (borç-azaltma yan özellik) */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("ozet")} style={[styles.tab, tab === "ozet" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "ozet" && { color: colors.ink }]}>Özet</Text>
        </Pressable>
        <Pressable onPress={() => setTab("icgoru")} style={[styles.tab, tab === "icgoru" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "icgoru" && { color: colors.ink }]}>İçgörü</Text>
        </Pressable>
      </View>

      {tab === "ozet" ? (
        <Card>
          <Text style={styles.h}>Ödeme kaydet</Text>
          <Field
            label="Tutar"
            value={payAmount}
            onChangeText={setPayAmount}
            keyboardType="numeric"
            placeholder="örn. 5.000"
          />
          <Button title="Ödemeyi kaydet" onPress={logPayment} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.h}>Sadece asgarisini ödersen</Text>
            <Text style={{ color: colors.inkSoft }}>{TRAP_TEXT[trap.verdict]}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: spacing(1) }}>
              Tahmini aylık faiz {formatTRY(trap.nextMonthInterest)} · {formatPercent(trap.monthlyRate)}/ay
              {trap.rateIsEstimate ? "  ≈ tahmini" : ""}
            </Text>
          </Card>

          <Card>
            <Text style={styles.h}>Biraz fazlası ne kazandırır?</Text>
            <Field
              label="Bu ay ne kadar fazla ayırabilirsin?"
              value={extraWhatIf}
              onChangeText={setExtraWhatIf}
              keyboardType="numeric"
              placeholder="örn. 2.000"
            />
            {extraVal > 0 && (
              <Text style={{ color: colors.inkSoft }}>
                Bu ay <Text style={{ fontWeight: "700" }}>{formatTRY(extraVal)}</Text> fazladan
                ayırırsan yaklaşık <Text style={{ fontWeight: "700" }}>{formatTRY(avoided)}</Text> faiz
                yükünden kaçınırsın.
              </Text>
            )}
            {trap.rateIsEstimate && (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing(1) }}>
                TCMB üst sınır oranıyla hesapladık; kendi oranını girersen daha doğru olur.
              </Text>
            )}
          </Card>
        </>
      )}

      <Button title="Borcu sil" variant="link" onPress={remove} />
    </ScrollView>
  );
}

const styles = {
  h: { fontSize: 16, fontWeight: "700" as const, color: colors.ink, marginBottom: spacing(1) },
  tabs: { flexDirection: "row" as const, gap: 6, marginBottom: spacing(1.5) },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: "center" as const,
  },
  tabActive: { backgroundColor: "#d1fae5", borderColor: colors.primary },
  tabText: { fontWeight: "700" as const, color: colors.inkSoft },
};
