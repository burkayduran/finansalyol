// Supabase mutation hatalarını tek tip ele al: dev'de gerçek hata console'a +
// mesaja yansır; production'da kullanıcı sade Türkçe görür.
import { Alert } from "react-native";
import { captureException } from "./monitoring";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

/** Hata varsa kullanıcıya gösterir ve true döner (çağıran erken çıkar). */
export function handleSaveError(scope: string, error: unknown, friendly = "Kaydedilemedi. Lütfen tekrar dene."): boolean {
  if (!error) return false;
  // eslint-disable-next-line no-console
  console.error(`[${scope}] save error`, error);
  captureException(error, { scope });
  const detail = (error as { message?: string })?.message;
  Alert.alert("Kaydedilemedi", isDev && detail ? `${friendly}\n\n[dev] ${detail}` : friendly);
  return true;
}

/** Hane yoksa uyar; kayıt akışı durdurulmalı. */
export function ensureHousehold(householdId: string | null | undefined): householdId is string {
  if (!householdId) {
    Alert.alert("Hane bulunamadı", "Kayıt eklemek için önce bir hane oluşturmalısın.");
    return false;
  }
  return true;
}
