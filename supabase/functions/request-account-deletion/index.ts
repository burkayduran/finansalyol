// Public (girişsiz) hesap silme talebi — Google Play gerekliliği.
// - E-posta alır, DOĞRULAMA bağlantısı gönderir (yalnız e-posta ile SİLMEZ).
// - Rate limit (kullanıcı numaralandırmayı önlemek için yanıt her zaman generic).
// - Token hash'lenmiş saklanır; düz token yalnız e-posta bağlantısında.
//
// Server env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_CONFIRM_URL, RESEND_*.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const RATE_MAX = 3; // saatte
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let email = "";
  try { email = String(((await req.json()) as any)?.email ?? "").trim().toLowerCase(); } catch { /* */ }
  // Generic yanıt: e-posta geçersiz olsa bile kullanıcı numaralandırma yapılmaz.
  const generic = json({ ok: true, message: "Talebin alındıysa doğrulama e-postası gönderildi." });
  if (!EMAIL_RE.test(email)) return generic;

  // Rate limit (son 1 saat).
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("public_deletion_requests")
    .select("id", { count: "exact", head: true })
    .eq("email_norm", email)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) return generic;

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + 3600_000).toISOString();
  await admin.from("public_deletion_requests").insert({
    email_norm: email, token_hash: tokenHash, status: "pending_verification", expires_at: expires,
  });

  const base = Deno.env.get("PUBLIC_CONFIRM_URL") ?? "";
  const link = `${base}?token=${token}`;
  await sendEmail(
    email,
    "Finansal Yol — hesap silme doğrulaması",
    `Hesap silme talebini aldık. Onaylamak için bağlantıya tıkla (1 saat geçerli):\n\n${link}\n\nBu talebi sen yapmadıysan bu e-postayı yok sayabilirsin.`
  );
  return generic;
});
