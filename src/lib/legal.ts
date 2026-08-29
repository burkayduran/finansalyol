// Hukuki kabul kaydı. Kullanım Koşulları = kabul; KVKK/Gizlilik = bilgilendirme (okudum).
// E-posta doğrulaması nedeniyle kayıt anında oturum olmayabilir → pending marker ile
// bir sonraki oturumda DB'ye yazılır (user_metadata'da bırakılmaz).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Metin sürümleri — esaslı değişiklikte artır (yeniden kabul akışı bu sürümle tetiklenir).
export const LEGAL_VERSIONS = {
  terms: "2026-01-01",
  kvkk_notice: "2026-01-01",
  privacy: "2026-01-01",
} as const;

export type LegalDocType = keyof typeof LEGAL_VERSIONS;

const PENDING_KEY = "fy_pending_legal";

type PendingRow = { document_type: LegalDocType; document_version: string; locale?: string };

const SIGNUP_DOCS: PendingRow[] = [
  { document_type: "terms", document_version: LEGAL_VERSIONS.terms },
  { document_type: "kvkk_notice", document_version: LEGAL_VERSIONS.kvkk_notice },
  { document_type: "privacy", document_version: LEGAL_VERSIONS.privacy },
];

async function insertRows(userId: string, rows: PendingRow[]): Promise<void> {
  if (rows.length === 0) return;
  await supabase.from("legal_acceptances").insert(
    rows.map((r) => ({
      user_id: userId,
      document_type: r.document_type,
      document_version: r.document_version,
      locale: r.locale ?? "tr-TR",
    }))
  );
}

/** Kayıt anında oturum varsa hemen yaz, yoksa pending işaretle (sonra flush). */
export async function recordSignupAcceptance(session: { user: { id: string } } | null): Promise<void> {
  if (session?.user?.id) {
    await insertRows(session.user.id, SIGNUP_DOCS).catch(() => markPending());
  } else {
    await markPending();
  }
}

async function markPending(): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(SIGNUP_DOCS));
}

/** Oturum açıldığında bekleyen kabul kaydını DB'ye taşı (idempotent-best-effort). */
export async function flushPendingAcceptance(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const rows = JSON.parse(raw) as PendingRow[];
    await insertRows(userId, rows);
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    /* best-effort; sonraki oturumda tekrar denenir */
  }
}
