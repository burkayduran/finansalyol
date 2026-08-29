// Hata izleme (Sentry) — DSN yoksa sessiz (dev/Expo Go bozulmaz).
// Native modül/DSN eksikse tüm çağrılar no-op'a düşer.
let sentry: typeof import("@sentry/react-native") | null = null;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require("@sentry/react-native");
    sentry?.init({
      dsn: DSN,
      enableAutoSessionTracking: true,
      // PII göndermeyelim (KVKK): kullanıcı e-posta/isim otomatik toplanmasın.
      sendDefaultPii: false,
    });
  } catch {
    sentry = null;
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    sentry?.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* no-op */
  }
}
