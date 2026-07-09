// Paylaşılan küçük UI parçaları (sıcak ve az; iç prensipler ekrana yazılmaz).
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius, spacing } from "@/theme";
import { BANKS, OTHER_BANK, OTHER_BANK_CODE, type Bank } from "@/core/banks";

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  danger,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "link" | "neutral";
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean; // yıkıcı aksiyon (sil/geri al) — link/ghost metni kırmızı
}) {
  // Bakır = yönlendirme rengi: üçüncül link'ler bakır. Ghost = birincil-yakın (lacivert).
  // Neutral = sakin günlük kayıt (beyaz zemin, ince çerçeve, ink metin). Yıkıcı her zaman kırmızı.
  const textColor = danger
    ? colors.danger
    : variant === "link"
      ? colors.accent
      : variant === "neutral"
        ? colors.ink
        : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "ghost" && styles.btnGhost,
        variant === "neutral" && styles.btnNeutral,
        variant === "link" && styles.btnLink,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : textColor} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "primary" ? { color: colors.primaryInk } : { color: textColor },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Üçüncül yönlendirme satırı — bakır metin + chevron. Bir sonraki ekrana götürür. */
export function NavRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.navRow}>
      <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>{title}</Text>
      <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 14 }}>›</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Tutar alanı — yazarken tr-TR binlik ayracıyla biçimlendirir (tam sayı TRY). */
export function AmountField({
  label, hint, value, onChangeText, placeholder,
}: {
  label: string; hint?: string; value: string;
  onChangeText: (v: string) => void; placeholder?: string;
}) {
  const format = (t: string) => {
    const digits = t.replace(/[^\d]/g, "");
    return digits ? Number(digits).toLocaleString("tr-TR") : "";
  };
  return (
    <Field
      label={label} hint={hint} value={value} placeholder={placeholder}
      keyboardType="numeric" onChangeText={(t) => onChangeText(format(t))}
    />
  );
}

/** Tarih alanı — native takvim. Değer Date tutulur; görünen GG.AA.YYYY. */
export function DateField({
  label, value, onChange, hint,
}: {
  label: string; value: Date | null; onChange: (d: Date) => void; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = value
    ? `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`
    : "";
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: display ? colors.ink : colors.muted, fontSize: 16 }}>
          {display || "GG.AA.YYYY"}
        </Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {open && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setOpen(Platform.OS === "ios");
            if (e.type === "set" && d) onChange(d);
            if (e.type === "dismissed") setOpen(false);
          }}
        />
      )}
    </View>
  );
}

export function EstimateBadge() {
  // Küçük "≈ tahmini" — dokununca açıklama (üst katmanda Pressable ile sarılır).
  return <Text style={styles.estimate}>≈ tahmini</Text>;
}

/** Genel amaçlı seçici — modal liste. (Para birimi, emtia türü vb.) */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Seç…",
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: current ? colors.ink : colors.muted, fontSize: 16 }}>
          {current?.label ?? placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={[styles.fieldLabel, { fontSize: 16, marginBottom: 8 }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={{ color: colors.ink, fontSize: 16 }}>{item.label}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Banka seçici — modal liste + "Diğer (elle yaz)". {code, name} döndürür.
 * "Diğer" -> code "other" + kullanıcı girişi name.
 */
export interface BankValue { code: string; name: string }
export function BankSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BankValue;
  onChange: (v: BankValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(value.code === OTHER_BANK_CODE);

  const pick = (bank: Bank | "other") => {
    if (bank === "other") {
      setOther(true);
      onChange({ code: OTHER_BANK_CODE, name: "" });
    } else {
      setOther(false);
      onChange({ code: bank.code, name: bank.name });
    }
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: value.name || other ? colors.ink : colors.muted, fontSize: 16 }}>
          {value.name || (other ? "Diğer — elle yaz" : "Banka seç…")}
        </Text>
      </Pressable>

      {other && (
        <TextInput
          placeholder="Banka adını yaz"
          placeholderTextColor={colors.muted}
          style={[styles.input, { marginTop: 8 }]}
          value={value.name}
          onChangeText={(t) => onChange({ code: OTHER_BANK_CODE, name: t })}
        />
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={[styles.fieldLabel, { fontSize: 16, marginBottom: 8 }]}>Banka seç</Text>
            <FlatList
              data={[...BANKS, "other" as const]}
              keyExtractor={(item) => (item === "other" ? "other" : item.code)}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => pick(item)}>
                  <Text style={{ color: item === "other" ? colors.primary : colors.ink, fontSize: 16 }}>
                    {item === "other" ? OTHER_BANK : item.name}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing(1.5),
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing(0.5),
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  btnNeutral: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  btnLink: { backgroundColor: "transparent", paddingVertical: 8 },
  btnText: { fontWeight: "700", fontSize: 16 },
  field: { marginBottom: spacing(1.5) },
  fieldLabel: { fontWeight: "600", marginBottom: 6, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  hint: { color: colors.muted, fontSize: 13, marginTop: 4 },
  estimate: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    padding: spacing(2),
    maxHeight: "70%",
  },
  modalRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
});
