// Paylaşılan küçük UI parçaları (sıcak ve az; iç prensipler ekrana yazılmaz).
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, spacing } from "@/theme";
import { BANKS, OTHER_BANK } from "@/core/banks";

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "link";
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "ghost" && styles.btnGhost,
        variant === "link" && styles.btnLink,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "primary" ? { color: colors.primaryInk } : { color: colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
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
 * Banka seçici — modal liste + "Diğer (elle yaz)" serbest metin.
 * value gerçek banka adını tutar; listede yoksa "Diğer" modu açılır.
 */
export function BankSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(value !== "" && !BANKS.includes(value));

  const pick = (bank: string) => {
    if (bank === OTHER_BANK) {
      setOther(true);
      onChange("");
    } else {
      setOther(false);
      onChange(bank);
    }
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: value || other ? colors.ink : colors.muted, fontSize: 16 }}>
          {value || (other ? "Diğer — elle yaz" : "Banka seç…")}
        </Text>
      </Pressable>

      {other && (
        <TextInput
          placeholder="Banka adını yaz"
          placeholderTextColor={colors.muted}
          style={[styles.input, { marginTop: 8 }]}
          value={value}
          onChangeText={onChange}
        />
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={[styles.fieldLabel, { fontSize: 16, marginBottom: 8 }]}>Banka seç</Text>
            <FlatList
              data={[...BANKS, OTHER_BANK]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => pick(item)}
                >
                  <Text style={{ color: item === OTHER_BANK ? colors.primary : colors.ink, fontSize: 16 }}>
                    {item}
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
});
