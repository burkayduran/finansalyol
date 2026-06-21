// Oto-fiyat cron — manuel-önce, katmanlı. Desteklenen türler için assets.last_price'ı
// günceller; başarısız/desteklenmeyen kaynakta last_price MANUEL kalır (üzerine yazmaz).
//
// Mimari: PriceProvider arayüzü; kaynak başına bir uygulama. Sağlayıcılar İZOLE —
// biri kırılırsa diğerini etkilemez. Önce kripto (BtcTurk, TRY pariteli); fon/hisse/
// altın best-effort olarak sonra eklenir.
//
// "Oto-fiyat garantili günlük" vaadi YOK; kaynak bozulursa kâr/zarar manuel veriyle çalışır.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

export interface Price {
  price: number;
  currency: string;
  asOf: string;
}

export interface PriceProvider {
  /** Bu sağlayıcı hangi asset.kind'ları destekler. */
  supports: string[];
  /** price_source etiketi. */
  source: string;
  getPrice(symbol: string): Promise<Price | null>;
}

// --- Kripto: BtcTurk public ticker (TRY pariteli) -------------------------
const btcturk: PriceProvider = {
  supports: ["crypto"],
  source: "btcturk",
  async getPrice(symbol: string): Promise<Price | null> {
    const pair = `${symbol.toUpperCase()}_TRY`;
    const res = await fetch(`https://api.btcturk.com/api/v2/ticker?pairSymbol=${pair}`);
    if (!res.ok) return null;
    const json = await res.json();
    const last = json?.data?.[0]?.last;
    if (last == null) return null;
    return { price: Number(last), currency: "TRY", asOf: new Date().toISOString() };
  },
};

// Yeni sağlayıcılar buraya eklenir (tefas: fon, yahoo: hisse, xau: altın) — best-effort.
const PROVIDERS: PriceProvider[] = [btcturk];

async function run() {
  let updated = 0;
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const { data: assets } = await supabase
      .from("assets")
      .select("id, symbol, kind")
      .in("kind", provider.supports)
      .not("symbol", "is", null);

    for (const a of assets ?? []) {
      try {
        const price = await provider.getPrice((a as any).symbol);
        if (!price) continue;
        await supabase
          .from("assets")
          .update({
            last_price: price.price,
            last_price_at: price.asOf,
            price_source: provider.source,
          })
          .eq("id", (a as any).id);
        updated++;
      } catch (e) {
        // İzole: bir varlık/sağlayıcı hatası diğerlerini etkilemez.
        failures.push(`${provider.source}:${(a as any).symbol}: ${String(e)}`);
      }
    }
  }
  return { updated, failures };
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
