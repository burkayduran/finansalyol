// Gelen auth deep-link'lerini (şifre sıfırlama / oturum) oturuma çevirir.
// Supabase detectSessionInUrl kapalı (RN) — URL'i elle işleriz.
import { supabase } from "./supabase";

export async function handleAuthUrl(url: string | null): Promise<void> {
  if (!url) return;
  try {
    const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
    const params = new URLSearchParams(query);
    const hash = url.includes("#") ? url.split("#")[1] : "";
    const hp = new URLSearchParams(hash);

    // 1) PKCE akışı: ?code=
    const code = params.get("code");
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      return;
    }
    // 2) Implicit: #access_token=&refresh_token=
    const access_token = hp.get("access_token");
    const refresh_token = hp.get("refresh_token");
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
      return;
    }
    // 3) OTP recovery: ?token_hash=&type=recovery
    const token_hash = params.get("token_hash") ?? hp.get("token_hash");
    const type = (params.get("type") ?? hp.get("type")) as "recovery" | "email" | null;
    if (token_hash && type) {
      await supabase.auth.verifyOtp({ type, token_hash });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[deeplink] auth url işlenemedi", e);
  }
}
