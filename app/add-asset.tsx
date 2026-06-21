import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { Button, Card, Field, Select } from "@/components/ui";
import { parseTRYInput, formatTRY } from "@/core/format";
import { formatShortDate } from "@/core/dates";
import { depositYield } from "@/core/deposit";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/core/currencies";
import { colors, spacing } from "@/theme";
import type { AssetKind } from "@/lib/database.types";

const KINDS: { key: AssetKind; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "deposit", label: "Mevduat" },
  { key: "fund", label: "Fon" },
  { key: "stock", label: "Hisse" },
  { key: "commodity", label: "Emtia" },
  { key: "crypto", label: "Kripto" },
  { key: "other", label: "Diğer" },
];

const COMMODITIES = [
  { value: "gold", label: "Altın" },
  { value: "silver", label: "Gümüş" },
  { value: "platinum", label: "Platin" },
  { value: "palladium", label: "Paladyum" },
];

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function AddAsset() {
  const router = useRouter();
  const { householdId } = useSession();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AssetKind>("deposit");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [balance, setBalance] = useState("");
  // mevduat
  const [annualRate, setAnnualRate] = useState("");
  const [termDays, setTermDays] = useState("");
  const [stopaj, setStopaj] = useState("");
  // fiyatlı türler
  const [symbol, setSymbol] = useState("");
  const [commodityType, setCommodityType] = useState("gold");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [lastPrice, setLastPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const isDeposit = kind === "deposit";
  const isPriced = kind === "fund" || kind === "stock" || kind === "commodity" || kind === "crypto";
  const isCash = kind === "cash";

  const depositPreview = useMemo(() => {
    if (!isDeposit) return null;
    const principal = parseTRYInput(balance);
    const rate = parseTRYInput(annualRate);
    const days = Number(termDays);
    const tax = parseTRYInput(stopaj);
    if (!principal || !rate || !days) return null;
    return depositYield({ principal, annualRate: rate, termDays: days, stopaj: tax ?? 0 });
  }, [isDeposit, balance, annualRate, termDays, stopaj]);

  const save = async () => {
    if (!label.trim()) return Alert.alert("Eksik", "Bir etiket gir (örn. 'Acil fon').");

    let balanceVal = 0;
    if (!isPriced) {
      const b = parseTRYInput(balance);
      if (b == null || b < 0) return Alert.alert("Eksik", "Tutar gir.");
      balanceVal = b;
    }

    const qty = parseTRYInput(quantity);
    const buy = parseTRYInput(buyPrice);
    if (isPriced) {
      if (qty == null || qty <= 0) return Alert.alert("Eksik", "Adet/gram gir.");
      if (buy == null || buy <= 0) return Alert.alert("Eksik", "Alış fiyatı gir.");
    }

    setSaving(true);
    const { error } = await supabase.from("assets").insert({
      household_id: householdId!,
      label: label.trim(),
      kind,
      currency,
      balance: balanceVal,
      annual_rate: isDeposit ? parseTRYInput(annualRate) : null,
      term_days: isDeposit && termDays ? Number(termDays) : null,
      stopaj: isDeposit ? parseTRYInput(stopaj) : null,
      start_date: isDeposit ? new Date().toISOString().slice(0, 10) : null,
      symbol: isPriced && kind !== "commodity" ? symbol.trim() || null : null,
      commodity_type: kind === "commodity" ? commodityType : null,
      quantity: isPriced ? qty : null,
      buy_price: isPriced ? buy : null,
      last_price: isPriced ? parseTRYInput(lastPrice) : null,
      last_price_at: isPriced && lastPrice ? new Date().toISOString() : null,
      price_source: isPriced && lastPrice ? "manual" : null,
    });
    setSaving(false);
    if (error) return Alert.alert("Olmadı", error.message);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <Field label="Etiket" value={label} onChangeText={setLabel} placeholder="örn. Acil fon" />
        <Text style={styles.label}>Tür</Text>
        <View style={styles.segment}>
          {KINDS.map((k) => (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              style={[styles.seg, kind === k.key && styles.segActive]}
            >
              <Text style={[styles.segText, kind === k.key && { color: colors.ink }]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* cash / deposit / other: tutar */}
        {!isPriced && (
          <Field
            label={isDeposit ? "Anapara" : "Tutar"}
            value={balance}
            onChangeText={setBalance}
            keyboardType="numeric"
            placeholder="örn. 25.000"
          />
        )}

        {/* nakit: para birimi */}
        {isCash && (
          <Select label="Para birimi" value={currency} options={currencyOptions} onChange={setCurrency} />
        )}

        {/* mevduat */}
        {isDeposit && (
          <>
            <Field label="Yıllık faiz (%)" value={annualRate} onChangeText={setAnnualRate} keyboardType="numeric" placeholder="örn. 45" />
            <Field label="Vade (gün)" value={termDays} onChangeText={setTermDays} keyboardType="numeric" placeholder="örn. 92" />
            <Field label="Stopaj (%)" value={stopaj} onChangeText={setStopaj} keyboardType="numeric" placeholder="örn. 7.5" />
            {depositPreview && (
              <View style={styles.box}>
                <Row label="Brüt faiz" value={formatTRY(depositPreview.grossInterest)} />
                <Row label="Stopaj" value={"−" + formatTRY(depositPreview.tax)} />
                <Row label="Net faiz" value={formatTRY(depositPreview.netInterest)} strong />
                <Row label="Vade sonu" value={formatTRY(depositPreview.maturityValue)} strong />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {formatShortDate(depositPreview.maturityDate)} · ≈ tahmini
                </Text>
              </View>
            )}
          </>
        )}

        {/* fiyatlı türler: fon/hisse/emtia/kripto */}
        {isPriced && (
          <>
            {kind === "commodity" ? (
              <Select label="Emtia türü" value={commodityType} options={COMMODITIES} onChange={setCommodityType} />
            ) : (
              <Field
                label={kind === "fund" ? "Fon kodu" : kind === "stock" ? "Ticker" : "Coin sembolü"}
                value={symbol}
                onChangeText={setSymbol}
                autoCapitalize="characters"
                placeholder={kind === "fund" ? "örn. TTE" : kind === "stock" ? "örn. THYAO" : "örn. BTC"}
              />
            )}
            <Field
              label={kind === "commodity" ? "Gram" : "Adet"}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="örn. 10"
            />
            <Field label="Alış fiyatı (birim)" value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" placeholder="örn. 100" />
            <Field
              label="Güncel fiyat (opsiyonel)"
              value={lastPrice}
              onChangeText={setLastPrice}
              keyboardType="numeric"
              placeholder="boşsa alış fiyatı kullanılır"
              hint="Manuel girebilirsin; desteklenen türlerde oto-fiyat bunu günceller."
            />
            {kind !== "commodity" && (
              <Select label="Para birimi" value={currency} options={currencyOptions} onChange={setCurrency} />
            )}
          </>
        )}
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.inkSoft }}>{label}</Text>
      <Text style={{ color: colors.ink, fontWeight: strong ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const styles = {
  label: { fontWeight: "600" as const, marginBottom: 6, color: colors.ink },
  segment: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
  box: { backgroundColor: colors.bg, borderRadius: 12, padding: spacing(1.5), marginTop: spacing(0.5) },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 3 },
};
