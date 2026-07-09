// Hafif, kendi çizdiğimiz grafikler (navy palet). Ağır chart lib yok.
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText, Polyline } from "react-native-svg";
import { colors } from "@/theme";
import { formatTRY } from "@/core/format";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Halka (donut) grafik; ortada toplam etiketi. */
export function Donut({
  data,
  size = 180,
  thickness = 26,
  centerLabel,
  centerValue,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: number;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);

  let offset = 0;
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {/* zemin halka */}
          <Circle cx={cx} cy={cy} r={r} stroke={colors.line} strokeWidth={thickness} fill="none" />
          {total > 0 &&
            data.map((d, i) => {
              const frac = Math.max(0, d.value) / total;
              const seg = frac * C;
              const gap = data.length > 1 ? Math.min(seg, C * (2 / 360)) : 0; // segment arası ~2° boşluk
              const dash = Math.max(0, seg - gap);
              const el = (
                <Circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={d.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += seg;
              return el;
            })}
        </G>
        {(centerLabel || centerValue != null) && (
          <>
            {centerLabel && (
              <SvgText x={cx} y={cy - 6} fontSize={11} fill={colors.inkSoft} textAnchor="middle">
                {centerLabel}
              </SvgText>
            )}
            {centerValue != null && (
              <SvgText x={cx} y={cy + 15} fontSize={22} fontWeight="800" fill={colors.ink} textAnchor="middle">
                {formatTRY(centerValue)}
              </SvgText>
            )}
          </>
        )}
      </Svg>
    </View>
  );
}

/** Donut altı açıklama — renk · isim · tutar · yüzde. */
export function Legend({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color, marginRight: 8 }} />
          <Text style={{ color: colors.ink, fontSize: 13, flex: 1 }}>{d.label}</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginRight: 8 }}>{formatTRY(d.value)}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, width: 42, textAlign: "right" }}>
            %{Math.round((d.value / total) * 100)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface WeekBar {
  label: string;
  paid: number;
  pending: number;
  overdue: number;
}

/** Bu ay — haftalık ödeme yığın çubukları (ödenen/bekleyen/geciken). Tıklanınca hafta seçilir. */
export function UpcomingBars({
  weeks,
  maxHeight = 90,
  selected = null,
  onSelect,
}: {
  weeks: WeekBar[];
  maxHeight?: number;
  selected?: number | null;
  onSelect?: (i: number) => void;
}) {
  const totals = weeks.map((w) => w.paid + w.pending + w.overdue);
  const max = Math.max(1, ...totals);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {weeks.map((w, i) => {
          const total = totals[i];
          const h = (v: number) => (total > 0 ? (v / max) * maxHeight : 0);
          const isSel = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => onSelect?.(i)}
              disabled={!onSelect}
              style={{ flex: 1, alignItems: "center", opacity: selected != null && !isSel ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.inkSoft, fontSize: 12, marginBottom: 4, minHeight: 16, fontWeight: isSel ? "700" : "400" }}>
                {total > 0 ? formatTRY(total) : ""}
              </Text>
              <View style={{ height: maxHeight, justifyContent: "flex-end", width: "70%" }}>
                {total > 0 ? (
                  <View style={{ borderRadius: 4, overflow: "hidden" }}>
                    {w.overdue > 0 && <View style={{ height: h(w.overdue), backgroundColor: colors.danger }} />}
                    {w.pending > 0 && <View style={{ height: h(w.pending), backgroundColor: colors.primary }} />}
                    {w.paid > 0 && <View style={{ height: h(w.paid), backgroundColor: colors.ok }} />}
                  </View>
                ) : (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }} />
                )}
              </View>
              <Text style={{ color: isSel ? colors.accent : colors.muted, fontSize: 11, marginTop: 4, fontWeight: isSel ? "700" : "400" }}>
                {w.label}
              </Text>
              <View style={{ height: 2, width: "70%", marginTop: 2, borderRadius: 1, backgroundColor: isSel ? colors.accent : "transparent" }} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        <LegendDot color={colors.ok} label="Ödenen" />
        <LegendDot color={colors.primary} label="Bekleyen" />
        <LegendDot color={colors.danger} label="Geciken" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.inkSoft, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export interface MonthBar {
  label: string;
  income: number;
  outflow: number;
}

/** Aylık gelir vs çıkış (gider+borç) gruplu çubuk grafik. */
export function BarsMonthly({ months, height = 160 }: { months: MonthBar[]; height?: number }) {
  const padBottom = 18;
  const chartH = height - padBottom;
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.outflow]));
  const groupW = 100 / Math.max(1, months.length); // yüzde genişlik
  const barW = groupW * 0.28;

  return (
    <Svg width="100%" height={height}>
      {/* taban çizgisi */}
      <Line x1="0%" y1={chartH} x2="100%" y2={chartH} stroke={colors.line} strokeWidth={1} />
      {months.map((m, i) => {
        const base = i * groupW + groupW / 2;
        const incomeH = (m.income / max) * (chartH - 4);
        const outflowH = (m.outflow / max) * (chartH - 4);
        const negative = m.income - m.outflow < 0;
        return (
          <G key={i}>
            <Rect
              x={`${base - barW - 1}%`}
              y={chartH - incomeH}
              width={`${barW}%`}
              height={incomeH}
              rx={2}
              fill={colors.asset}
            />
            <Rect
              x={`${base + 1}%`}
              y={chartH - outflowH}
              width={`${barW}%`}
              height={outflowH}
              rx={2}
              fill={negative ? colors.danger : colors.inkSoft}
            />
            <SvgText x={`${base}%`} y={height - 5} fontSize={9} fill={colors.muted} textAnchor="middle">
              {m.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Trend çizgisi (net değer vb.). */
export function Sparkline({
  points,
  width = 300,
  height = 48,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={coords} fill="none" stroke={colors.primary} strokeWidth={2} />
    </Svg>
  );
}
