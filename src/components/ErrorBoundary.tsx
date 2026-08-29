import { Component, type ReactNode } from "react";
import { Text, View } from "react-native";
import { colors, spacing } from "@/theme";
import { Button } from "@/components/ui";
import { captureException } from "@/lib/monitoring";

interface State { hasError: boolean }

// Global hata sınırı — beklenmedik UI hatasında uygulama beyaz ekrana düşmesin.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[error-boundary]", error);
    captureException(error, { source: "error-boundary" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: spacing(3), backgroundColor: colors.bg }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: spacing(1) }}>
            Bir şeyler ters gitti
          </Text>
          <Text style={{ color: colors.inkSoft, marginBottom: spacing(2) }}>
            Beklenmedik bir hata oluştu. Tekrar deneyebilirsin.
          </Text>
          <Button title="Tekrar dene" onPress={() => this.setState({ hasError: false })} />
        </View>
      );
    }
    return this.props.children;
  }
}
