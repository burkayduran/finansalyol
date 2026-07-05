import { Pressable, Text, View } from "react-native";
import { formatTRY } from "@/core/format";
import { parseISODateLocal } from "@/core/dates";
import { badge, colors, spacing } from "@/theme";
import type { PaymentOccurrence, PaymentOccurrenceStatus } from "@/lib/database.types";

const STATUS: Record<PaymentOccurrenceStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Bekliyor", color: badge.neutralInk, bg: badge.neutralBg },
  partial: { label: "Kısmi", color: badge.warnInk, bg: badge.warnBg },
  paid: { label: "Ödendi", color: badge.okInk, bg: badge.okBg },
  overdue: { label: "Gecikti", color: badge.dangerInk, bg: badge.dangerBg },
  skipped: { label: "Atlandı", color: colors.muted, bg: badge.neutralBg },
};

function daysLeft(dueISO: string): string {
  const due = parseISODateLocal(dueISO);
  const t0 = new Date();
  const diff = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime()) / 86400000
  );
  if (diff === 0) return "Bugün son gün";
  if (diff < 0) return `${Math.abs(diff)} gün gecikti`;
  return `${diff} gün kaldı`;
}

export function OccurrenceRow({
  occ,
  personName,
  onPay,
  onSkip,
}: {
  occ: PaymentOccurrence;
  personName?: string;
  onPay?: () => void;
  onSkip?: () => void;
}) {
  const remaining = Math.max(0, Number(occ.amount_due) - Number(occ.amount_paid));
  const st = STATUS[occ.status];
  const done = occ.status === "paid" || occ.status === "skipped";
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontWeight: "600" }}>
          {occ.bank_name ?? occ.label ?? "Ödeme"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {personName ? `${personName} · ` : ""}{daysLeft(occ.due_date)}
        </Text>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={{ color: st.color, fontSize: 11, fontWeight: "700" }}>{st.label}</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatTRY(remaining > 0 ? remaining : Number(occ.amount_due))}</Text>
        {!done && onPay && (
          <Pressable onPress={onPay} style={styles.payBtn}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Ödeme gir</Text>
          </Pressable>
        )}
        {!done && onSkip && (
          <Pressable onPress={onSkip} hitSlop={6}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Bu ay atla</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = {
  row: {
    flexDirection: "row" as const, alignItems: "center" as const,
    paddingVertical: spacing(1), borderTopWidth: 1, borderTopColor: colors.line,
  },
  badge: { alignSelf: "flex-start" as const, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  payBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primarySoft },
};
