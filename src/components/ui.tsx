// Paylaşılan küçük UI parçaları (sıcak ve az; iç prensipler ekrana yazılmaz).
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radius, spacing } from "@/theme";

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
});
