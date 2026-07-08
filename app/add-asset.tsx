import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";
import { AmountField, Button, Card, Field, Select } from "@/components/ui";
import { OwnerSelect, type OwnerValue } from "@/components/OwnerSelect";
import { parseTRYInput, formatTRY } from "@/core/format";
import { formatShortDate, toISODateLocal } from "@/core/dates";
import { depositYield } from "@/core/deposit";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/core/currencies";
import { toTRY } from "@/core/fx";
import { track } from "@/lib/analytics";
import { ensureHousehold, handleSaveError } from "@/lib/errors";
import { useFxRates } from "@/hooks/useFxRates";
import { colors, spacing } from "@/theme";
import type { AssetKind } from "@/lib/database.types";

const KINDS: { key: AssetKind; label: string }[] = [
  { key: "cash", label: "Nakit" },
  { key: "deposit", label: "Mevduat" },
  { key: "fund", label: "Fon" },
  { key: "stock", label: "Hisse" },
  { key: "gold", label: "Altın" },
  { key: "fx", label: "Döviz" },
  { key: "other", label: "Diğer" },
];
const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

export default function AddAsset() {
  const router = useRouter();
  const { householdId } = useSession();
  const navigation = useNavigation();
  const fxRates = useFxRates();
  const params = useLocalSearchParams<{ person?: string; id?: string }>();
  const editId = params.id;

  const [owner, setOwner] = useState<OwnerValue>(
    params.person ? { ownerType: "person", personId: params.person } : { ownerType: "person", personId: null }
  );
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AssetKind>("cash");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [balance, setBalance] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [termDays, setTermDays] = useState("");
  const [stopaj, setStopaj] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [lastPrice, setLastPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    if (editId) navigation.setOptions({ title: "Varlığı düzenle" });
  }, [navigation, editId]);

  useEffect(() => {
    if (!editId) return;
    supabase.from("assets").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setOwner({ ownerType: data.owner_type, personId: data.person_id });
      setLabel(data.label);
      setKind(data.kind);
      setCurrency(data.currency);
      setBalance(data.balance != null ? String(data.balance) : "");
      setAnnualRate(data.annual_rate != null ? String(data.annual_rate) : "");
      setTermDays(data.term_days != null ? String(data.term_days) : "");
      setStopaj(data.stopaj != null ? String(data.stopaj) : "");
      setSymbol(data.symbol ?? "");
      setQuantity(data.quantity != null ? String(data.quantity) : "");
      setBuyPrice(data.buy_price != null ? String(data.buy_price) : "");
      setLastPrice(data.last_price != null ? String(data.last_price) : "");
    });
  }, [editId]);

  const removeItem = () =>
    Alert.alert("Varlığı sil", "Bu varlık silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => { await supabase.from("assets").delete().eq("id", editId!); router.back(); } },
    ]);

  const isDeposit = kind === "deposit";
  const isPriced = kind === "fund" || kind === "stock" || kind === "gold";
  const showCurrency = kind === "cash" || kind === "fx" || kind === "stock" || kind === "other";
  const usesBalance = !isPriced; // cash/deposit/fx/other tutar girer

  const depositPreview = useMemo(() => {
    if (!isDeposit) return null;
    const principal = parseTRYInput(balance);
    const r = parseTRYInput(annualRate);
    const days = Number(termDays);
    if (!principal || !r || !days) return null;
    return depositYield({ principal, annualRate: r, termDays: days, stopaj: parseTRYInput(stopaj) ?? 0 });
  }, [isDeposit, balance, annualRate, termDays, stopaj]);

  const fxPreview = useMemo(() => {
    if (!showCurrency || currency === "TRY") return null;
    const amt = parseTRYInput(balance);
    if (!amt) return null;
    return { value: toTRY(amt, currency, fxRates), rateDate: fxRates[currency]?.rate_date };
  }, [showCurrency, currency, balance, fxRates]);

  const ownerValid = owner.ownerType === "household" || owner.personId != null;

  const save = async () => {
    if (!ensureHousehold(householdId)) return;
    if (!ownerValid) return Alert.alert("Eksik", "Kimin için olduğunu seç.");
    if (!label.trim()) return Alert.alert("Eksik", "Bir açıklama gir.");

    let balanceVal = 0;
    if (usesBalance) {
      const b = parseTRYInput(balance);
      if (b == null || b < 0) return Alert.alert("Eksik", "Tutar gir.");
      balanceVal = b;
    }
    const qty = parseTRYInput(quantity);
    const buy = parseTRYInput(buyPrice);
    if (isPriced) {
      if (qty == null || qty <= 0) return Alert.alert("Eksik", kind === "gold" ? "Gram gir." : "Adet gir.");
      if (buy == null || buy <= 0) return Alert.alert("Eksik", "Alış fiyatı gir.");
    }

    setSaving(true);
    const payload = {
      household_id: householdId!,
      owner_type: owner.ownerType,
      person_id: owner.ownerType === "person" ? owner.personId : null,
      label: label.trim(),
      kind,
      currency: showCurrency ? currency : "TRY",
      balance: balanceVal,
      annual_rate: isDeposit ? parseTRYInput(annualRate) : null,
      term_days: isDeposit && termDays ? Number(termDays) : null,
      stopaj: isDeposit ? parseTRYInput(stopaj) : null,
      start_date: isDeposit ? toISODateLocal(new Date()) : null,
      symbol: kind === "fund" || kind === "stock" ? symbol.trim() || null : null,
      commodity_type: kind === "gold" ? "gold" : null,
      quantity: isPriced ? qty : null,
      buy_price: isPriced ? buy : null,
      last_price: isPriced ? parseTRYInput(lastPrice) : null,
      last_price_at: isPriced && lastPrice ? new Date().toISOString() : null,
      price_source: isPriced && lastPrice ? "manual" : null,
    };
    const { error } = editId
      ? await supabase.from("assets").update(payload as never).eq("id", editId)
      : await supabase.from("assets").insert(payload as never);
    setSaving(false);
    if (handleSaveError("add-asset", error, "Varlık kaydedilemedi. Lütfen tekrar dene.")) return;
    if (!editId) track("asset_added", { asset_kind: kind, owner_type: owner.ownerType });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing(2) }}>
      <Card>
        <OwnerSelect value={owner} onChange={setOwner} />
        <Field label="Açıklama" value={label} onChangeText={setLabel} placeholder="örn. Acil fon, altın bilezik" />

        <Text style={styles.label}>Tür</Text>
        <View style={styles.segment}>
          {KINDS.map((k) => (
            <Pressable key={k.key} onPress={() => setKind(k.key)} style={[styles.seg, kind === k.key && styles.segActive]}>
              <Text style={[styles.segText, kind === k.key && { color: colors.ink }]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        {usesBalance && (
          <AmountField
            label={isDeposit ? "Anapara" : kind === "fx" ? "Döviz tutarı" : "Tutar"}
            value={balance}
            onChangeText={setBalance}
            placeholder="örn. 25.000"
          />
        )}

        {showCurrency && (
          <>
            <Select label="Para birimi" value={currency} options={currencyOptions} onChange={setCurrency} />
            {currency !== "TRY" && (
              <Text style={styles.note}>
                {fxPreview?.value != null
                  ? `≈ ${formatTRY(fxPreview.value)} · TCMB ${fxPreview.rateDate ?? ""} alış kuru`
                  : "Kur henüz çekilmedi"}
              </Text>
            )}
          </>
        )}

        {isDeposit && (
          <>
            <Field label="Yıllık faiz (%)" value={annualRate} onChangeText={setAnnualRate} keyboardType="numeric" placeholder="örn. 45" />
            <Field label="Vade (gün)" value={termDays} onChangeText={setTermDays} keyboardType="numeric" placeholder="örn. 92" />
            <Field label="Stopaj (%)" value={stopaj} onChangeText={setStopaj} keyboardType="numeric" placeholder="örn. 7.5" />
            {depositPreview && (
              <View style={styles.box}>
                <Row label="Net faiz" value={formatTRY(depositPreview.netInterest)} strong />
                <Row label="Vade sonu" value={formatTRY(depositPreview.maturityValue)} strong />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {formatShortDate(depositPreview.maturityDate)}
                </Text>
              </View>
            )}
          </>
        )}

        {isPriced && (
          <>
            {kind !== "gold" && (
              <Field
                label={kind === "fund" ? "Fon kodu" : "Ticker"}
                value={symbol}
                onChangeText={setSymbol}
                autoCapitalize="characters"
                placeholder={kind === "fund" ? "örn. TTE" : "örn. THYAO"}
              />
            )}
            <Field label={kind === "gold" ? "Gram" : "Adet"} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="örn. 10" />
            <Field label="Alış fiyatı (birim)" value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" placeholder="örn. 100" />
            <Field label="Güncel fiyat (ops.)" value={lastPrice} onChangeText={setLastPrice} keyboardType="numeric" placeholder="boşsa alış fiyatı kullanılır" />
          </>
        )}
      </Card>
      <Button title="Kaydet" onPress={save} loading={saving} />
      {editId && <Button title="Varlığı sil" variant="link" danger onPress={removeItem} />}
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
  note: { color: colors.muted, fontSize: 13, marginTop: -spacing(0.5), marginBottom: spacing(1) },
  segment: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: spacing(1.5) },
  seg: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  segActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  segText: { color: colors.inkSoft, fontWeight: "600" as const },
  box: { backgroundColor: colors.bg, borderRadius: 12, padding: spacing(1.5), marginTop: spacing(0.5) },
  row: { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 3 },
};
