// Hatırlatma motoru — günlük cron (Supabase Scheduled Edge Function).
// Akış: yaklaşan vadeleri bul -> ilgili üyelere Expo push + (haftalık) e-posta gönder.
// Idempotency: reminders_log; aynı bildirim aynı gün ikinci kez gönderilmez.
//
// Gerekli secret'lar (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM
//
// Çalıştırma: günde bir kez (cron). Bkz. supabase/functions/reminder-cron/cron.md

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TZ = "Europe/Istanbul";
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const RESEND_API = "https://api.resend.com/emails";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// --- tarih yardımcıları (TR saat dilimi) ---------------------------------
function istanbulNow(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: TZ });
  return new Date(s);
}

function daysUntilDue(dueDay: number, today: Date): number {
  const y = today.getFullYear();
  const m = today.getMonth();
  const clamp = (yr: number, mo: number) =>
    Math.min(dueDay, new Date(yr, mo + 1, 0).getDate());
  let target = new Date(y, m, clamp(y, m));
  const t0 = new Date(y, m, today.getDate());
  if (target < t0) target = new Date(y, m + 1, clamp(y, m + 1));
  return Math.round((target.getTime() - t0.getTime()) / 86400000);
}

function nextDueDateISO(dueDay: number, today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() + daysUntilDue(dueDay, today));
  return d.toISOString().slice(0, 10);
}

const fmtTRY = (n: number) => "₺" + Math.round(Number(n)).toLocaleString("tr-TR");

// --- BDDK asgari (push metni için kısa hesap) ------------------------------
function mandatoryMinimum(d: Debt): number {
  if (d.kind === "credit_card" && d.card_limit != null) {
    const rate = Number(d.card_limit) > 50000 ? 0.4 : 0.2;
    return Math.min(Number(d.balance), Number(d.balance) * rate);
  }
  if (d.kind === "loan" && d.installment != null) {
    return Math.min(Number(d.balance), Number(d.installment));
  }
  return 0;
}

interface Debt {
  id: string;
  household_id: string;
  kind: "credit_card" | "kmh" | "loan";
  bank: string;
  label: string | null;
  balance: number;
  card_limit: number | null;
  installment: number | null;
  due_day: number;
}

interface Recipient {
  member_id: string;
  email: string | null;
  push_enabled: boolean;
  email_enabled: boolean;
  days_before: number;
  weekly_digest: boolean;
  digest_weekday: number;
  tokens: string[];
}

// Bir hanenin üyelerini + tercih + token'larını getir.
async function recipientsFor(householdId: string): Promise<Recipient[]> {
  const { data: members } = await supabase
    .from("household_members")
    .select("member_id, profiles(email)")
    .eq("household_id", householdId);

  const out: Recipient[] = [];
  for (const m of members ?? []) {
    const memberId = (m as any).member_id as string;
    const { data: pref } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("member_id", memberId)
      .maybeSingle();
    const { data: toks } = await supabase
      .from("push_tokens")
      .select("expo_token")
      .eq("member_id", memberId);

    out.push({
      member_id: memberId,
      email: (m as any).profiles?.email ?? null,
      push_enabled: pref?.push_enabled ?? true,
      email_enabled: pref?.email_enabled ?? true,
      days_before: pref?.days_before ?? 1,
      weekly_digest: pref?.weekly_digest ?? true,
      digest_weekday: pref?.digest_weekday ?? 1,
      tokens: (toks ?? []).map((t: any) => t.expo_token),
    });
  }
  return out;
}

// Idempotent gönderim kaydı; daha önce gönderildiyse false döner.
async function claim(
  debtId: string | null,
  memberId: string,
  channel: "push" | "email",
  kind: "advance" | "due_day" | "weekly",
  dueDate: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from("reminders_log")
    .insert({ debt_id: debtId, member_id: memberId, channel, kind, due_date: dueDate });
  return !error; // unique ihlali -> zaten gönderilmiş
}

async function sendPush(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({ to, title, body, sound: "default" }));
  await fetch(EXPO_PUSH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? "Borç Takip <hatirlatma@borctakip.app>",
      to,
      subject,
      html,
    }),
  });
}

async function run() {
  const today = istanbulNow();
  const weekday = today.getDay();
  let pushCount = 0;
  let emailCount = 0;

  const { data: debts } = await supabase.from("debts").select("*");
  if (!debts) return { pushCount, emailCount };

  // Hane bazlı recipient cache.
  const cache = new Map<string, Recipient[]>();
  const getRecipients = async (hh: string) => {
    if (!cache.has(hh)) cache.set(hh, await recipientsFor(hh));
    return cache.get(hh)!;
  };

  // --- 1) Borç başına push (gün önce + son gün) ---------------------------
  for (const raw of debts as Debt[]) {
    const days = daysUntilDue(raw.due_day, today);
    const dueISO = nextDueDateISO(raw.due_day, today);
    const recipients = await getRecipients(raw.household_id);
    const name = raw.label ?? `${raw.bank} ${raw.kind === "credit_card" ? "kartı" : ""}`.trim();
    const min = mandatoryMinimum(raw);
    const minText = min > 0 ? ` — asgari ${fmtTRY(min)}` : "";

    for (const r of recipients) {
      if (!r.push_enabled || r.tokens.length === 0) continue;

      if (days === r.days_before && days > 0) {
        if (await claim(raw.id, r.member_id, "push", "advance", dueISO)) {
          await sendPush(
            r.tokens,
            "Ödeme yaklaşıyor",
            `${days} gün sonra ${name} son ödeme günü${minText}.`
          );
          pushCount++;
        }
      }
      if (days === 0) {
        if (await claim(raw.id, r.member_id, "push", "due_day", dueISO)) {
          await sendPush(r.tokens, "Bugün son ödeme günü", `Bugün ${name} son ödeme günü${minText}.`);
          pushCount++;
        }
      }
    }
  }

  // --- 2) Haftalık e-posta özeti (hane geneli) ---------------------------
  const byHousehold = new Map<string, Debt[]>();
  for (const d of debts as Debt[]) {
    if (!byHousehold.has(d.household_id)) byHousehold.set(d.household_id, []);
    byHousehold.get(d.household_id)!.push(d);
  }

  const weekISO = today.toISOString().slice(0, 10);
  for (const [hh, hhDebts] of byHousehold) {
    const recipients = await getRecipients(hh);
    const upcoming = hhDebts
      .map((d) => ({ d, days: daysUntilDue(d.due_day, today) }))
      .filter((x) => x.days <= 7)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length === 0) continue;

    const rows = upcoming
      .map((x) => {
        const min = mandatoryMinimum(x.d);
        const name = x.d.label ?? x.d.bank;
        return `<li>${name} — ${x.days} gün${min > 0 ? ` (asgari ${fmtTRY(min)})` : ""}</li>`;
      })
      .join("");
    const html = `<p>Bu hafta ${upcoming.length} ödemeniz var:</p><ul>${rows}</ul>
      <p style="color:#888;font-size:12px">Tahminler ≈ TCMB üst sınır oranıyla; kendi oranınızı girerseniz daha doğru olur.</p>`;

    for (const r of recipients) {
      if (!r.email_enabled || !r.weekly_digest || !r.email) continue;
      if (weekday !== r.digest_weekday) continue;
      if (await claim(null, r.member_id, "email", "weekly", weekISO)) {
        await sendEmail(r.email, "Bu haftanın ödemeleri", html);
        emailCount++;
      }
    }
  }

  return { pushCount, emailCount };
}

Deno.serve(async () => {
  try {
    const result = await run();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
