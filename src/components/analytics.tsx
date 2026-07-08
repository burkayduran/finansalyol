// Pano analiz kartları — kişi bazlı dağılım donut'u + nakit akışı (etkileşimli).
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui";
import { Donut as Ring, type Slice } from "@/components/charts";
import { CashflowChart, type CashflowMonth } from "@/components/CashflowChart";
import { formatTRY } from "@/core/format";
import { toISODateLocal } from "@/core/dates";
import { colors, spacing, typography } from "@/theme";
import type { PersonCard } from "@/hooks/useHousehold";
import type { MonthlyFlow } from "@/core/cashflow";

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function Donut({ personCards, colors: palette }: { personCards: PersonCard[]; colors: string[] }) {
  const [mode, setMode] = useState<"debt" | "asset">("debt");
  const [sel, setSel] = useState(0);

  const slices: Slice[] = personCards
    .map((c, i) => ({
      label: c.name,
      value: mode === "debt" ? c.totalDebt : c.totalAsset,
      color: palette[i % palette.length],
    }))
    .filter((s) => s.value > 0);

  if (slices.length === 0) return null;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const idx = Math.min(sel, slices.length - 1);
  const selected = slices[idx];
  const modeLabel = mode === "debt" ? "Borç" : "Varlık";
  const centerLabel = `${selected.label} · ${modeLabel}`;

  return (
    <Card>
      <Text style={typography.cardTitle}>Dağılım</Text>
      <View style={styles.toggle}>
        {(["debt", "asset"] as const).map((m) => (
          <Pressable key={m} onPress={() => { setMode(m); setSel(0); }} style={[styles.seg, mode === m && styles.segActive]}>
            <Text style={[styles.segText, mode === m && { color: colors.ink }]}>{m === "debt" ? "Borç" : "Varlık"}</Text>
          </Pressable>
        ))}
      </View>

      <Ring
        data={slices}
        size={160}
        centerValue={selected.value}
        centerLabel={centerLabel}
      />

      <View style={{ marginTop: spacing(1) }}>
        {slices.map((s, i) => (
          <Pressable key={s.label} onPress={() => setSel(i)} style={[styles.legendRow, i === idx && { backgroundColor: colors.bg }]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color, marginRight: 8 }} />
            <Text style={{ color: colors.ink, fontSize: 13, flex: 1, fontWeight: i === idx ? "700" : "400" }}>{s.label}</Text>
            <Text style={{ color: colors.ink, fontSize: 13, marginRight: 8 }}>{formatTRY(s.value)}</Text>
            <Text style={{ color: colors.inkSoft, fontSize: 13, width: 44, textAlign: "right" }}>%{Math.round((s.value / total) * 100)}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

export function CashflowChartWrap({ projection, onDetail }: { projection: MonthlyFlow[]; onDetail?: () => void }) {
  const months: CashflowMonth[] = projection.slice(0, 6).map((m) => ({
    monthKey: toISODateLocal(m.month),
    label: TR_MONTHS[m.month.getMonth()],
    income: m.income,
    outflow: m.expense + m.debtDue,
    net: m.income - m.expense - m.debtDue,
  }));
  const [sel, setSel] = useState<string | undefined>(months[0]?.monthKey);
  if (!months.some((m) => m.income > 0 || m.outflow > 0)) return null;

  return (
    <Card>
      <Text style={typography.cardTitle}>Nakit akışı · planlanan</Text>
      <CashflowChart data={months} selectedMonthKey={sel} onSelectMonth={setSel} />
      {onDetail && (
        <Pressable onPress={onDetail}>
          <Text style={{ color: colors.accent, fontWeight: "700", textAlign: "center", marginTop: 8 }}>Detayı gör →</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = {
  toggle: { flexDirection: "row" as const, gap: 6, marginVertical: spacing(1) },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, alignItems: "center" as const },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.accent },
  segText: { color: colors.inkSoft, fontWeight: "600" as const, fontSize: 13 },
  legendRow: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8 },
};
