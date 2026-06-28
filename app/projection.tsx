import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useHousehold } from "@/hooks/useHousehold";
import { Card } from "@/components/ui";
import { formatTRY } from "@/core/format";
import { projectMonths, type InstallmentDebt } from "@/core/projection";
import { colors, spacing } from "@/theme";

const TR_MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

export default function Projection() {
  const { debts } = useHousehold();

  const installmentDebts: InstallmentDebt[] = useMemo(
    () =>
      debts
        .filter(
          (d) =>
            (d.kind === "loan" || d.kind === "installment_kmh") &&
            d.installment != null &&
            d.term_count != null &&
            d.first_installment_date != null
        )
        .map((d) => ({
          id: d.id,
          label: d.label ?? d.bank,
          installment: Number(d.installment),
          termCount: Number(d.term_count),
          firstInstallmentDate: new Date(d.first_installment_date as string),
          balance: Number(d.total_amount ?? d.balance), // taksit programı toplam tutardan
        })),
    [debts]
  );

  const rows = useMemo(() => projectMonths(installmentDebts, 12), [installmentDebts]);

  if (installmentDebts.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
        <Card>
          <Text style={{ color: colors.inkSoft }}>
            Taksitli borç (kredi ya da taksitli KMH) ekleyince burada 12 aylık plan görünür.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <View style={styles.head}>
          <Text style={[styles.cell, styles.hcell, { flex: 1.2 }]}>Ay</Text>
          <Text style={[styles.cell, styles.hcell, styles.num]}>Bu ay ödenecek</Text>
          <Text style={[styles.cell, styles.hcell, styles.num]}>Kalan borç</Text>
        </View>
        {rows.map((r) => (
          <View key={r.month.toISOString()} style={styles.row}>
            <Text style={[styles.cell, { flex: 1.2, color: colors.ink }]}>
              {TR_MONTHS[r.month.getMonth()]} {r.month.getFullYear()}
            </Text>
            <Text style={[styles.cell, styles.num, { color: r.totalDue > 0 ? colors.ink : colors.muted }]}>
              {r.totalDue > 0 ? formatTRY(r.totalDue) : "—"}
            </Text>
            <Text style={[styles.cell, styles.num, { color: colors.inkSoft }]}>
              {formatTRY(r.remainingTotal)}
            </Text>
          </View>
        ))}
      </Card>
      <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: spacing(0.5) }}>
        Yalnız taksit programı girilen borçlar (kredi / taksitli KMH) hesaba katılır.
      </Text>
    </ScrollView>
  );
}

const styles = {
  head: { flexDirection: "row" as const, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 6 },
  row: { flexDirection: "row" as const, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  cell: { flex: 1, fontSize: 14 },
  hcell: { color: colors.muted, fontSize: 12, fontWeight: "700" as const },
  num: { textAlign: "right" as const },
};
