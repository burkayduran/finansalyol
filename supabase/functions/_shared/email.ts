// Resend e-posta adapter'ı (Deno, paylaşılan). Credential yoksa NOT_CONFIGURED döner;
// sahte "gönderildi" ÜRETMEZ. Hassas içerik loglanmaz.
export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  notConfigured?: boolean;
}

export async function sendEmail(to: string, subject: string, text: string, timeoutMs = 10000): Promise<EmailResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!key || !from) return { ok: false, notConfigured: true, error: "NOT_CONFIGURED" };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `resend_http_${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: (data as any)?.id };
  } catch (_e) {
    return { ok: false, error: "network_or_timeout" };
  } finally {
    clearTimeout(t);
  }
}
