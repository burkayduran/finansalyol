// FX cron — TCMB today.xml'i çekip fx_rates'e upsert eder.
// Açık, güvenilir, günlük kaynak (TCMB ~15:30 yayınlar). Hafta sonu/tatil: son değer kalır.
// Çalıştırma: pg_cron ile her iş günü ~16:00 (bkz. cron.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

// Değerlemede kullandığımız + UI'daki top-10 para birimleri.
const WANTED = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "SAR", "RUB", "CNY"];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const tag = (block: string, name: string): number | null => {
  const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  const v = m?.[1]?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// JPY/RUB gibi bazı kurlar "Unit"=100 üzerinden verilir; birim başına normalize et.
function perUnit(value: number | null, unit: number): number | null {
  if (value == null) return null;
  return unit > 0 ? value / unit : value;
}

async function run() {
  const res = await fetch(TCMB_URL);
  const xml = await res.text();

  const dateMatch = xml.match(/Date="([^"]+)"/);
  const rateDate = parseTcmbDate(dateMatch?.[1]);

  const rows: Record<string, unknown>[] = [];
  const blocks = xml.split("<Currency").slice(1);
  for (const raw of blocks) {
    const code = raw.match(/CurrencyCode="([A-Z]+)"/)?.[1];
    if (!code || !WANTED.includes(code)) continue;
    const unit = tag(raw, "Unit") ?? 1;
    rows.push({
      currency: code,
      forex_buying: perUnit(tag(raw, "ForexBuying"), unit),
      forex_selling: perUnit(tag(raw, "ForexSelling"), unit),
      banknote_buying: perUnit(tag(raw, "BanknoteBuying"), unit),
      banknote_selling: perUnit(tag(raw, "BanknoteSelling"), unit),
      rate_date: rateDate,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    await supabase.from("fx_rates").upsert(rows, { onConflict: "currency" });
  }
  return { count: rows.length, rateDate };
}

// "06/15/2026" (TCMB Date) -> ISO "2026-06-15"
function parseTcmbDate(s?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!s) return today;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return today;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
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
