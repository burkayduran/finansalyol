// Satın alma doğrulama — authenticated Edge Function (RevenueCat YOK).
// - JWT doğrular; user_id JWT'den alınır (istemcinin plan/expiry değerine GÜVENİLMEZ).
// - Apple/Google doğrulaması adapter ile ayrılır; gerçek credential yoksa NOT_CONFIGURED döner
//   (production'da SAHTE başarı üretmez).
// - Sonuç idempotent şekilde entitlements'a yazılır; transaction uniqueness ile replay/cross-user engellenir.
// - Receipt/token açık loglanmaz.
//
// Server env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   APPLE_* / GOOGLE_* (gerçek doğrulama için; yoksa NOT_CONFIGURED).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ürün → plan (src/core/plan.ts ile birebir).
const PRODUCTS: Record<string, { plan: string; limit: number }> = {
  family_4_monthly: { plan: "family_4", limit: 4 },
  family_5_monthly: { plan: "family_5", limit: 5 },
  family_6_monthly: { plan: "family_6", limit: 6 },
  family_7_monthly: { plan: "family_7", limit: 7 },
};

type SubStatus = "active" | "trial" | "grace_period" | "billing_retry" | "expired" | "cancelled" | "refunded" | "revoked";

interface Verified {
  productId: string;
  originalTransactionId: string;
  latestTransactionId: string;
  status: SubStatus;
  premiumUntil: string | null;
  environment: "sandbox" | "production";
}

class NotConfigured extends Error {
  constructor() { super("NOT_CONFIGURED"); }
}

// --- Apple adapter (App Store Server API) ---
async function verifyApple(_receipt: string, _productId: string): Promise<Verified> {
  const key = Deno.env.get("APPLE_KEY_ID");
  const issuer = Deno.env.get("APPLE_ISSUER_ID");
  const p8 = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!key || !issuer || !p8) throw new NotConfigured();
  // TODO(deploy): App Store Server API ile receipt/transaction doğrula, status + expiry çöz.
  //   Bu adım gerçek Apple credential'ı gerektirir (MANUAL_ACTIONS). Sahte sonuç üretilmez.
  throw new NotConfigured();
}

// --- Google adapter (Play Developer API) ---
async function verifyGoogle(_token: string, _productId: string): Promise<Verified> {
  const sa = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const pkg = Deno.env.get("GOOGLE_PACKAGE_NAME");
  if (!sa || !pkg) throw new NotConfigured();
  // TODO(deploy): Play Developer API purchases.subscriptionsv2.get ile token doğrula.
  throw new NotConfigured();
}

async function run(userId: string, body: any) {
  const platform = body?.platform;
  const productId = body?.productId;
  if (platform !== "ios" && platform !== "android") return json({ ok: false, error: "bad_platform" }, 400);
  if (!productId || !PRODUCTS[productId]) return json({ ok: false, error: "unsupported_product" }, 400);

  let v: Verified;
  try {
    if (platform === "ios") {
      if (!body?.receipt) return json({ ok: false, error: "missing_receipt" }, 400);
      v = await verifyApple(body.receipt, productId);
    } else {
      if (!body?.token) return json({ ok: false, error: "missing_token" }, 400);
      v = await verifyGoogle(body.token, productId);
    }
  } catch (e) {
    if (e instanceof NotConfigured) return json({ ok: false, error: "NOT_CONFIGURED" }, 501);
    return json({ ok: false, error: "verification_failed" }, 502);
  }

  // Doğrulanan ürün, istenen ürünle aynı olmalı.
  if (v.productId !== productId) return json({ ok: false, error: "product_mismatch" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Cross-user binding koruması: aynı original_transaction_id başka kullanıcıda mı?
  const { data: existing } = await admin
    .from("entitlements")
    .select("user_id")
    .eq("platform", platform)
    .eq("original_transaction_id", v.originalTransactionId)
    .maybeSingle();
  if (existing && (existing as any).user_id !== userId) {
    return json({ ok: false, error: "transaction_bound_to_other_user" }, 409);
  }

  const meta = PRODUCTS[productId];
  const nowISO = new Date().toISOString();
  // Idempotent upsert (user_id PK).
  const { error } = await admin.from("entitlements").upsert(
    {
      user_id: userId,
      plan: meta.plan,
      person_limit: meta.limit,
      platform,
      product_id: productId,
      subscription_status: v.status,
      premium_until: v.premiumUntil,
      original_transaction_id: v.originalTransactionId,
      latest_transaction_id: v.latestTransactionId,
      environment: v.environment,
      last_receipt_check_at: nowISO,
      updated_at: nowISO,
    },
    { onConflict: "user_id" }
  );
  if (error) return json({ ok: false, error: "persist_failed" }, 500);

  return json({ ok: true, plan: meta.plan, status: v.status, premium_until: v.premiumUntil });
}

Deno.serve(async (httpReq) => {
  if (httpReq.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (httpReq.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const authHeader = httpReq.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: unknown = {};
  try { body = await httpReq.json(); } catch { body = {}; }
  return run(userData.user.id, body);
});
