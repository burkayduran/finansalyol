// Gerçek hesap silme — authenticated Edge Function.
// - JWT doğrular; kullanıcı YALNIZ kendi hesabını siler (istemciden gelen user_id'ye güvenmez).
// - Service-role yalnız server env'den okunur.
// - Idempotent: tekrar çağrımda veri bozmaz; hata halinde status=failed + güvenli retry.
// - Hane senaryoları: yalnız üye → üyelik kaldır; owner+tek üye → hane sil; owner+başka üye →
//   silme öncesi geçerli yeni owner (aktif üye, kendisi değil) ZORUNLU (request.replacement_owner_id).
// - Hassas veri loglanmaz.
//
// Secret'lar (server env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Hane senaryosu kararı (src/core/deletion.ts kuralının Deno kopyası).
function resolveDeletion(ctx: {
  isOwner: boolean; otherMemberCount: number;
  replacementValid: boolean;
}): "remove_membership" | "delete_household_and_data" | "transfer_then_remove" | "needs_replacement_owner" {
  if (!ctx.isOwner) return "remove_membership";
  if (ctx.otherMemberCount <= 0) return "delete_household_and_data";
  return ctx.replacementValid ? "transfer_then_remove" : "needs_replacement_owner";
}

async function deleteHouseholdData(admin: any, hh: string) {
  // Çocuk kayıtları güvenli sırayla sil (FK cascade'e bağlı kalmadan deterministik).
  await admin.from("payment_occurrences").delete().eq("household_id", hh);
  await admin.from("payments").delete().eq("household_id", hh);
  await admin.from("cash_flows").delete().eq("household_id", hh);
  await admin.from("assets").delete().eq("household_id", hh);
  await admin.from("debts").delete().eq("household_id", hh);
  await admin.from("persons").delete().eq("household_id", hh);
  await admin.from("household_invites").delete().eq("household_id", hh);
  await admin.from("household_members").delete().eq("household_id", hh);
  await admin.from("households").delete().eq("id", hh);
}

async function run(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Aktif talebi bul (idempotent: yoksa yeni pending oluştur).
  let { data: req } = await admin
    .from("account_deletion_requests")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (!req) {
    const ins = await admin
      .from("account_deletion_requests")
      .insert({ user_id: userId, requested_by: userId, status: "pending" })
      .select("*")
      .single();
    req = ins.data;
  }
  if (!req) return json({ ok: false, error: "request_not_found" }, 400);

  await admin
    .from("account_deletion_requests")
    .update({ status: "processing", processing_started_at: new Date().toISOString(), last_attempt_at: new Date().toISOString() })
    .eq("id", req.id);

  try {
    // Kullanıcının haneleri
    const { data: memberships } = await admin
      .from("household_members")
      .select("household_id, role")
      .eq("member_id", userId);

    for (const m of memberships ?? []) {
      const hh = (m as any).household_id as string;
      const isOwner = (m as any).role === "owner";
      const { data: others } = await admin
        .from("household_members")
        .select("member_id, role")
        .eq("household_id", hh)
        .neq("member_id", userId);
      const otherCount = (others ?? []).length;

      const replacementId = (req as any).replacement_owner_id as string | null;
      // replacement_owner_id bir persons.id; ilgili linked_member aktif üye mi?
      let replacementValid = false;
      let replacementMemberId: string | null = null;
      if (replacementId) {
        const { data: rp } = await admin
          .from("persons").select("linked_member_id, household_id").eq("id", replacementId).maybeSingle();
        replacementMemberId = (rp as any)?.linked_member_id ?? null;
        replacementValid =
          !!replacementMemberId &&
          replacementMemberId !== userId &&
          (rp as any)?.household_id === hh &&
          (others ?? []).some((o: any) => o.member_id === replacementMemberId);
      }

      const action = resolveDeletion({ isOwner, otherMemberCount: otherCount, replacementValid });

      if (action === "needs_replacement_owner") {
        await admin
          .from("account_deletion_requests")
          .update({ status: "failed", failure_reason: "replacement_owner_required", retry_count: ((req as any).retry_count ?? 0) + 1 })
          .eq("id", req.id);
        return json({ ok: false, error: "replacement_owner_required", household_id: hh }, 409);
      }

      if (action === "delete_household_and_data") {
        await deleteHouseholdData(admin, hh);
      } else if (action === "transfer_then_remove") {
        await admin.from("household_members").update({ role: "owner" }).eq("household_id", hh).eq("member_id", replacementMemberId);
        await admin.from("households").update({ created_by: replacementMemberId }).eq("id", hh);
        // Kullanıcının bu hanedeki linked person kaydını çöz (deterministik: kayıtları korunur, bağ kaldırılır).
        await admin.from("persons").update({ linked_member_id: null }).eq("household_id", hh).eq("linked_member_id", userId);
        await admin.from("household_members").delete().eq("household_id", hh).eq("member_id", userId);
      } else {
        // remove_membership: veriler hanede kalır; kullanıcının person bağı kaldırılır.
        await admin.from("persons").update({ linked_member_id: null }).eq("household_id", hh).eq("linked_member_id", userId);
        await admin.from("household_members").delete().eq("household_id", hh).eq("member_id", userId);
      }
    }

    // Kullanıcıya bağlı kayıtlar
    await admin.from("push_tokens").delete().eq("member_id", userId);
    await admin.from("notification_prefs").delete().eq("member_id", userId);
    await admin.from("entitlements").delete().eq("user_id", userId);
    await admin.from("legal_acceptances").delete().eq("user_id", userId);
    await admin.from("consult_requests").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // Auth kullanıcısı (idempotent: yoksa hatayı yut)
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (_e) {
      /* zaten silinmiş olabilir */
    }

    await admin
      .from("account_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", req.id);

    return json({ ok: true, status: "completed" });
  } catch (e) {
    await admin
      .from("account_deletion_requests")
      .update({ status: "failed", failure_reason: "internal_error", retry_count: ((req as any).retry_count ?? 0) + 1, last_attempt_at: new Date().toISOString() })
      .eq("id", req.id);
    // Hassas detay loglanmaz; genel hata döner.
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

Deno.serve(async (httpReq) => {
  if (httpReq.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (httpReq.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const authHeader = httpReq.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  // JWT'yi kullanıcı bağlamında doğrula; user_id JWT'den alınır (istemci gövdesine güvenilmez).
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);

  return run(userData.user.id);
});
