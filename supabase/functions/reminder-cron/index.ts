// Hatırlatma motoru — günlük cron (Supabase Scheduled Edge Function).
// - CRON_SECRET ile korunur (Authorization: Bearer <secret> veya x-cron-secret). Yanlış/eksik → 401.
// - Push (herkes) + E-posta (yalnız aktif premium + email_enabled + doğrulanmış e-posta).
// - Gönderim durum modeli: claimed → sending → sent/failed (gönderilmeden sent sayılmaz).
// - Push yanıtı kontrol edilir; DeviceNotRegistered token'ları temizlenir.
//
// Secret'lar (server env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//   RESEND_API_KEY, RESEND_FROM (e-posta için).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/email.ts";

const TZ = "Europe/Istanbul";
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const MAX_ATTEMPTS = 3;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function checkCron(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : (req.headers.get("x-cron-secret") ?? "");
  return timingSafeEqual(provided, expected);
}

function istanbulNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
function daysUntil(dateISO: string, today: Date): number {
  const d = new Date(dateISO);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
const fmtTRY = (n: number) => "₺" + Math.round(Number(n)).toLocaleString("tr-TR");

function windowOpen(pref: any, days: number): { open: boolean; tag: string } {
  if (days === 7) return { open: !!pref.remind_7d, tag: "7d" };
  if (days === 3) return { open: !!pref.remind_3d, tag: "3d" };
  if (days === 1) return { open: !!pref.remind_1d, tag: "1d" };
  if (days === 0) return { open: !!pref.remind_due_day, tag: "due" };
  if (days === -1) return { open: !!pref.remind_overdue, tag: "overdue" };
  return { open: false, tag: "" };
}
function subscriptionActive(e: any, now: Date): boolean {
  const notExpired = !e.premium_until || new Date(e.premium_until) >= now;
  if (["active", "trial", "grace_period", "billing_retry"].includes(e.subscription_status)) return notExpired;
  if (e.subscription_status === "cancelled") return !!e.premium_until && new Date(e.premium_until) >= now;
  return false;
}

// reminders_log claim-or-retry: gönderim tek kez; başarısızsa MAX_ATTEMPTS'e dek tekrar.
async function claimOrRetry(occId: string, dueDate: string, memberId: string, channel: string, tag: string): Promise<string | null> {
  const kind = `occ_${tag}`;
  const ins = await supabase
    .from("reminders_log")
    .insert({ occurrence_id: occId, member_id: memberId, channel, kind, due_date: dueDate, status: "claimed", attempt_count: 0 })
    .select("id")
    .maybeSingle();
  if (ins.data?.id) return ins.data.id as string;
  // Conflict → mevcut kaydı incele.
  const { data: row } = await supabase
    .from("reminders_log").select("id, status, attempt_count")
    .eq("occurrence_id", occId).eq("member_id", memberId).eq("channel", channel).eq("kind", kind).maybeSingle();
  if (!row) return null;
  if (row.status === "sent") return null; // zaten gönderildi
  if (row.status === "failed" && (row.attempt_count ?? 0) < MAX_ATTEMPTS) return row.id as string; // retry
  return null; // claimed/sending (in-flight) veya max retry
}
async function markSending(id: string) {
  await supabase.from("reminders_log").update({ status: "sending", last_attempt_at: new Date().toISOString() }).eq("id", id);
}
async function markSent(id: string) {
  await supabase.from("reminders_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
}
async function markFailed(id: string, err: string, prevAttempts: number) {
  await supabase.from("reminders_log").update({ status: "failed", last_error: err.slice(0, 300), attempt_count: prevAttempts + 1 }).eq("id", id);
}

async function sendPushChecked(tokenRows: { token: string; id: string }[], title: string, body: string): Promise<boolean> {
  if (!tokenRows.length) return false;
  try {
    const res = await fetch(EXPO_PUSH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenRows.map((t) => ({ to: t.token, title, body, sound: "default" }))),
    });
    const out = await res.json().catch(() => ({}));
    const tickets = (out?.data ?? []) as any[];
    let anyOk = false;
    for (let i = 0; i < tickets.length; i++) {
      const tk = tickets[i];
      if (tk?.status === "ok") anyOk = true;
      else if (tk?.details?.error === "DeviceNotRegistered") {
        // Geçersiz token'ı temizle.
        await supabase.from("push_tokens").delete().eq("id", tokenRows[i].id);
      }
    }
    return anyOk || res.ok;
  } catch (_e) {
    return false;
  }
}

async function run() {
  const today = istanbulNow();
  let pushCount = 0;
  let emailCount = 0;

  const { data: occs } = await supabase
    .from("payment_occurrences").select("*").in("status", ["pending", "partial", "overdue"]);
  if (!occs) return { pushCount, emailCount };

  // Premium user seti (owner premium'u hane erişimini belirler).
  const { data: ents } = await supabase.from("entitlements").select("*");
  const premiumUsers = new Set<string>();
  for (const e of ents ?? []) if (subscriptionActive(e, today)) premiumUsers.add((e as any).user_id);

  const prefCache = new Map<string, any[]>();
  const personMemberCache = new Map<string, Map<string, string | null>>();
  const ownerCache = new Map<string, string[]>();
  const userInfoCache = new Map<string, { email: string | null; verified: boolean }>();

  const getUserInfo = async (memberId: string) => {
    if (!userInfoCache.has(memberId)) {
      const { data } = await supabase.auth.admin.getUserById(memberId);
      const u = (data as any)?.user;
      userInfoCache.set(memberId, { email: u?.email ?? null, verified: !!u?.email_confirmed_at });
    }
    return userInfoCache.get(memberId)!;
  };
  const getOwners = async (hh: string) => {
    if (!ownerCache.has(hh)) {
      const { data } = await supabase.from("household_members").select("member_id").eq("household_id", hh).eq("role", "owner");
      ownerCache.set(hh, (data ?? []).map((r: any) => r.member_id));
    }
    return ownerCache.get(hh)!;
  };
  const getPrefs = async (hh: string) => {
    if (!prefCache.has(hh)) {
      const { data: members } = await supabase.from("household_members").select("member_id").eq("household_id", hh);
      const out: any[] = [];
      for (const m of members ?? []) {
        const memberId = (m as any).member_id;
        const { data: pref } = await supabase.from("notification_prefs").select("*").eq("member_id", memberId).maybeSingle();
        const { data: toks } = await supabase.from("push_tokens").select("id, expo_token").eq("member_id", memberId);
        out.push({
          member_id: memberId,
          push_enabled: pref?.push_enabled ?? true,
          email_enabled: pref?.email_enabled ?? true,
          remind_7d: pref?.remind_7d ?? true, remind_3d: pref?.remind_3d ?? true, remind_1d: pref?.remind_1d ?? true,
          remind_due_day: pref?.remind_due_day ?? true, remind_overdue: pref?.remind_overdue ?? true,
          scope: pref?.scope ?? "all",
          hide_amount: pref?.hide_amount_in_notifications ?? true,
          tokenRows: (toks ?? []).map((t: any) => ({ token: t.expo_token, id: t.id })),
        });
      }
      prefCache.set(hh, out);
    }
    return prefCache.get(hh)!;
  };
  const getPersonMap = async (hh: string) => {
    if (!personMemberCache.has(hh)) {
      const { data: persons } = await supabase.from("persons").select("id, linked_member_id").eq("household_id", hh);
      const map = new Map<string, string | null>();
      for (const p of persons ?? []) map.set((p as any).id, (p as any).linked_member_id ?? null);
      personMemberCache.set(hh, map);
    }
    return personMemberCache.get(hh)!;
  };
  const inScope = (p: any, occ: any, personMap: Map<string, string | null>) => {
    if (p.scope === "all") return true;
    if (occ.owner_type === "household") return p.scope === "household" || p.scope === "all";
    if (p.scope === "own") return occ.person_id != null && personMap.get(occ.person_id) === p.member_id;
    return false;
  };

  for (const occ of occs as any[]) {
    const days = daysUntil(occ.due_date, today);
    if (![7, 3, 1, 0, -1].includes(days)) continue;
    const prefs = await getPrefs(occ.household_id);
    const personMap = await getPersonMap(occ.household_id);
    const owners = await getOwners(occ.household_id);
    const householdPremium = owners.some((o) => premiumUsers.has(o));
    const remaining = Math.max(0, Number(occ.amount_due) - Number(occ.amount_paid));
    const name = occ.bank_name ?? occ.label ?? "Ödeme";
    const when = days < 0 ? "dün son gündü" : days === 0 ? "bugün" : `${days} gün kaldı`;

    for (const p of prefs) {
      const w = windowOpen(p, days);
      if (!w.open) continue;
      if (!inScope(p, occ, personMap)) continue;

      // PUSH
      if (p.push_enabled && p.tokenRows.length > 0) {
        const id = await claimOrRetry(occ.id, occ.due_date, p.member_id, "push", w.tag);
        if (id) {
          await markSending(id);
          const title = days < 0 ? "Ödeme gecikti" : days === 0 ? "Bugün son ödeme günü" : "Ödeme yaklaşıyor";
          const body = p.hide_amount ? `${name} — ${when}.` : `${name} — ${when}. Tutar: ${fmtTRY(remaining)}.`;
          const ok = await sendPushChecked(p.tokenRows, title, body);
          if (ok) { await markSent(id); pushCount++; } else { await markFailed(id, "push_failed", 0); }
        }
      }

      // E-POSTA (yalnız premium + email_enabled + doğrulanmış e-posta)
      if (p.email_enabled && householdPremium) {
        const info = await getUserInfo(p.member_id);
        if (info.email && info.verified) {
          const id = await claimOrRetry(occ.id, occ.due_date, p.member_id, "email", w.tag);
          if (id) {
            await markSending(id);
            const subject = days < 0 ? "Ödeme gecikti" : days === 0 ? "Bugün son ödeme günü" : "Yaklaşan ödeme";
            const line = p.hide_amount ? `${name} — ${when}.` : `${name} — ${when}. Tutar: ${fmtTRY(remaining)}.`;
            const r = await sendEmail(info.email, subject, `${line}\n\nFinansal Yol`);
            if (r.ok) { await markSent(id); emailCount++; }
            else { await markFailed(id, r.error ?? "email_failed", 0); }
          }
        }
      }
    }
  }
  return { pushCount, emailCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!checkCron(req)) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const result = await run();
    return json({ ok: true, ...result });
  } catch (_e) {
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
