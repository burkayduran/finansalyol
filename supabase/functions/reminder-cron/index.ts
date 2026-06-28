// Hatırlatma motoru — günlük cron (Supabase Scheduled Edge Function).
// Artık borçlardan değil, payment_occurrences üzerinden çalışır:
// yalnız ÖDENMEMİŞ (pending/partial) ve hatırlatma penceresine denk gelen olaylar.
//
// Secret'lar: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TZ = "Europe/Istanbul";
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const RESEND_API = "https://api.resend.com/emails";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

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

interface Pref {
  member_id: string;
  email: string | null;
  push_enabled: boolean;
  email_enabled: boolean;
  remind_7d: boolean;
  remind_3d: boolean;
  remind_1d: boolean;
  remind_due_day: boolean;
  remind_overdue: boolean;
  scope: "own" | "household" | "all";
  tokens: string[];
}

// Bu gün offset'i için hatırlatma penceresi açık mı?
function windowOpen(p: Pref, days: number): { open: boolean; tag: string } {
  if (days === 7) return { open: p.remind_7d, tag: "7d" };
  if (days === 3) return { open: p.remind_3d, tag: "3d" };
  if (days === 1) return { open: p.remind_1d, tag: "1d" };
  if (days === 0) return { open: p.remind_due_day, tag: "due" };
  if (days === -1) return { open: p.remind_overdue, tag: "overdue" }; // gecikmenin ertesi günü
  return { open: false, tag: "" };
}

async function prefsForHousehold(householdId: string): Promise<Pref[]> {
  const { data: members } = await supabase
    .from("household_members")
    .select("member_id, profiles(email)")
    .eq("household_id", householdId);
  const out: Pref[] = [];
  for (const m of members ?? []) {
    const memberId = (m as any).member_id as string;
    const { data: pref } = await supabase
      .from("notification_prefs").select("*").eq("member_id", memberId).maybeSingle();
    const { data: toks } = await supabase
      .from("push_tokens").select("expo_token").eq("member_id", memberId);
    out.push({
      member_id: memberId,
      email: (m as any).profiles?.email ?? null,
      push_enabled: pref?.push_enabled ?? true,
      email_enabled: pref?.email_enabled ?? true,
      remind_7d: pref?.remind_7d ?? true,
      remind_3d: pref?.remind_3d ?? true,
      remind_1d: pref?.remind_1d ?? true,
      remind_due_day: pref?.remind_due_day ?? true,
      remind_overdue: pref?.remind_overdue ?? true,
      scope: pref?.scope ?? "all",
      tokens: (toks ?? []).map((t: any) => t.expo_token),
    });
  }
  return out;
}

// Üye, occurrence'ı kapsamına göre görmeli mi?
function inScope(p: Pref, occ: any, personMember: Map<string, string | null>): boolean {
  if (p.scope === "all") return true;
  if (occ.owner_type === "household") return p.scope === "household" || p.scope === "all";
  // person occurrence: own -> bu kişi bu üyeye bağlıysa
  if (p.scope === "own") return occ.person_id != null && personMember.get(occ.person_id) === p.member_id;
  if (p.scope === "household") return false;
  return true;
}

async function claim(
  occId: string, dueDate: string, memberId: string, channel: string, tag: string
): Promise<boolean> {
  const { error } = await supabase
    .from("reminders_log")
    .insert({ occurrence_id: occId, member_id: memberId, channel, kind: `occ_${tag}`, due_date: dueDate });
  return !error;
}

async function sendPush(tokens: string[], title: string, body: string) {
  if (!tokens.length) return;
  await fetch(EXPO_PUSH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: "default" }))),
  });
}

async function run() {
  const today = istanbulNow();
  let pushCount = 0;

  // Açık (ödenmemiş) occurrence'ları çek.
  const { data: occs } = await supabase
    .from("payment_occurrences")
    .select("*")
    .in("status", ["pending", "partial", "overdue"]);
  if (!occs) return { pushCount };

  // Hane bazlı pref cache + kişi->üye eşlemesi.
  const prefCache = new Map<string, Pref[]>();
  const personMemberCache = new Map<string, Map<string, string | null>>();
  const getPrefs = async (hh: string) => {
    if (!prefCache.has(hh)) prefCache.set(hh, await prefsForHousehold(hh));
    return prefCache.get(hh)!;
  };
  const getPersonMap = async (hh: string) => {
    if (!personMemberCache.has(hh)) {
      const { data: persons } = await supabase
        .from("persons").select("id, linked_member_id").eq("household_id", hh);
      const map = new Map<string, string | null>();
      for (const p of persons ?? []) map.set((p as any).id, (p as any).linked_member_id ?? null);
      personMemberCache.set(hh, map);
    }
    return personMemberCache.get(hh)!;
  };

  for (const occ of occs as any[]) {
    const days = daysUntil(occ.due_date, today);
    // İlgilendiğimiz offsetler: 7,3,1,0 ve gecikmenin ertesi günü (-1).
    if (![7, 3, 1, 0, -1].includes(days)) continue;
    const prefs = await getPrefs(occ.household_id);
    const personMap = await getPersonMap(occ.household_id);
    const remaining = Math.max(0, Number(occ.amount_due) - Number(occ.amount_paid));
    const name = occ.bank_name ?? occ.label ?? "Ödeme";

    for (const p of prefs) {
      if (!p.push_enabled || p.tokens.length === 0) continue;
      const w = windowOpen(p, days);
      if (!w.open) continue;
      if (!inScope(p, occ, personMap)) continue;
      if (!(await claim(occ.id, occ.due_date, p.member_id, "push", w.tag))) continue;

      const title =
        days < 0 ? "Ödeme gecikti" : days === 0 ? "Bugün son ödeme günü" : "Ödeme yaklaşıyor";
      const when = days < 0 ? "dün son gündü" : days === 0 ? "bugün" : `${days} gün kaldı`;
      await sendPush(p.tokens, title, `${name} — ${when}. Tutar: ${fmtTRY(remaining)}.`);
      pushCount++;
    }
  }

  return { pushCount };
}

Deno.serve(async () => {
  try {
    const result = await run();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
