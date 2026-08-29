// Public hesap silme doğrulaması — e-posta bağlantısındaki token'ı onaylar.
// Token geçerliyse: eşleşen auth kullanıcısı için account_deletion_requests(pending) oluşturur.
// Gerçek silme delete-account worker'ında yürür. Owner+başka üye senaryosu uygulama içi
// yeni-owner seçimi gerektirir; public akış bunu toplayamaz → bu durumda kullanıcı uygulamadan devam eder.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function page(msg: string): Response {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finansal Yol — Hesap Silme</title></head>
<body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#16203A">
<h1 style="font-size:20px">Finansal Yol</h1><p style="color:#586079;line-height:1.5">${msg}</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("Geçersiz istek.");
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return page("Doğrulama bağlantısı geçersiz.");

  const tokenHash = await sha256Hex(token);
  const { data: row } = await admin
    .from("public_deletion_requests").select("*").eq("token_hash", tokenHash).maybeSingle();

  if (!row || row.status !== "pending_verification" || new Date(row.expires_at) < new Date()) {
    return page("Bağlantı geçersiz veya süresi dolmuş. Lütfen yeniden talep oluştur.");
  }

  await admin.from("public_deletion_requests").update({ status: "verified", verified_at: new Date().toISOString() }).eq("id", row.id);

  const { data: uid } = await admin.rpc("find_user_id_by_email", { p_email: row.email_norm });
  if (uid) {
    // Aktif talep yoksa oluştur (idempotent).
    const { data: existing } = await admin
      .from("account_deletion_requests").select("id").eq("user_id", uid).in("status", ["pending", "processing"]).maybeSingle();
    if (!existing) {
      await admin.from("account_deletion_requests").insert({ user_id: uid, requested_by: uid, status: "pending" });
    }
    await admin.from("public_deletion_requests").update({ status: "processed" }).eq("id", row.id);
  }

  return page(
    "Hesap silme talebin doğrulandı. Talebin işleme alınacak. Hanende başka üyeler varsa ve hane sahibiysen, " +
    "sahipliği devretmek için uygulamadan giriş yapıp Hesabım › Hesabımı sil adımını tamamlaman gerekebilir. " +
    "Not: Hesap silme, mağaza aboneliğini otomatik iptal etmez."
  );
});
