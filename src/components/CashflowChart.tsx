// Nakit akışı grafiği — aya dokununca seçili ay detayı. Mobile press odaklı.
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { colors, spacing } from "@/theme";
import { formatTRY } from "@/core/format";

export interface CashflowMonth {
  monthKey: string;
  label: string;
  income: number;
  outflow: number;
  net: number;
}

export function CashflowChart({
  data,
  selectedMonthKey,
  onSelectMonth,
  height = 150,
}: {
  data: CashflowMonth[];
  selectedMonthKey?: string;
  onSelectMonth?: (monthKey: string) => void;
  height?: number;
}) {
  const padBottom = 16;
  const chartH = height - padBottom;
  const max = Math.max(1, ...data.flatMap((m) => [m.income, m.outflow]));
  const n = Math.max(1, data.length);
  const groupW = 100 / n;
  const barW = groupW * 0.3;
  const selected = data.find((m) => m.monthKey === selectedMonthKey) ?? data[0];

  return (
    <View>
      <View>
        <Svg width="100%" height={height}>
          <Line x1="0%" y1={chartH} x2="100%" y2={chartH} stroke={colors.line} strokeWidth={1} />
          {data.map((m, i) => {
            const base = i * groupW + groupW / 2;
            const incomeH = (m.income / max) * (chartH - 4);
            const outflowH = (m.outflow / max) * (chartH - 4);
            const isSel = m.monthKey === selected?.monthKey;
            return (
              <G key={m.monthKey}>
                <Rect x={`${base - barW - 0.6}%`} y={chartH - incomeH} width={`${barW}%`} height={incomeH} rx={3} fill={colors.asset} opacity={isSel ? 1 : 0.5} />
                <Rect x={`${base + 0.6}%`} y={chartH - outflowH} width={`${barW}%`} height={outflowH} rx={3} fill={m.net < 0 ? colors.danger : colors.inkSoft} opacity={isSel ? 1 : 0.5} />
                <SvgText x={`${base}%`} y={height - 3} fontSize={9} fontWeight={isSel ? "700" : "400"} fill={isSel ? colors.ink : colors.muted} textAnchor="middle">{m.label}</SvgText>
              </G>
            );
          })}
        </Svg>
        {/* Barların üstünde şeffaf dokunma alanı (her ay komple tıklanır) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={{ flexDirection: "row", height: chartH }}>
            {data.map((m) => (
              <Pressable key={m.monthKey} onPress={() => onSelectMonth?.(m.monthKey)} style={{ flex: 1 }} />
            ))}
          </View>
        </View>
      </View>

      {selected && (
        <View style={styles.detail}>
          <Text style={{ fontWeight: "800", color: colors.ink, marginBottom: spacing(0.5) }}>{selected.label} ayrıntısı</Text>
          <Row label="Gelir" value={formatTRY(selected.income)} color={colors.asset} />
          <Row label="Gider + borç ödemesi" value={formatTRY(selected.outflow)} color={colors.inkSoft} />
          <View style={styles.netRow}>
            <Text style={{ color: colors.inkSoft }}>Net</Text>
            <View style={[styles.badge, { backgroundColor: selected.net < 0 ? "#fee2e2" : "#dcfce7" }]}>
              <Text style={{ color: selected.net < 0 ? "#991b1b" : "#166534", fontWeight: "800" }}>
                {formatTRY(selected.net)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.inkSoft }}>{label}</Text>
      <Text style={{ color, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const styles = {
  detail: { backgroundColor: colors.bg, borderRadius: 12, padding: spacing(1.5), marginTop: spacing(0.5) },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 3 },
  netRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
};
