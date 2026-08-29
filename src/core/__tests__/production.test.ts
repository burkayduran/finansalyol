import { describe, expect, it } from "vitest";
import { subscriptionGrantsAccess, planFromEntitlement } from "../subscription";
import {
  isSupportedProduct,
  productIdToPlan,
  selectAdapter,
  toEntitlementUpsert,
  NotConfiguredError,
  type StoreAdapter,
  type VerifiedSubscription,
} from "../purchaseVerification";
import { checkCronSecret, extractCronSecret, timingSafeEqual } from "../cronAuth";
import { windowTag, windowOpen, emailEligible, reminderBody, type ReminderPrefLike } from "../reminders";
import { resolveDeletion } from "../deletion";

const NOW = new Date("2026-06-15T12:00:00Z");
const FUTURE = "2026-07-15T12:00:00Z";
const PAST = "2026-05-15T12:00:00Z";

describe("subscription erişim kuralı", () => {
  it("active/trial/grace/billing_retry → süre dolmadıysa erişim", () => {
    for (const s of ["active", "trial", "grace_period", "billing_retry"]) {
      expect(subscriptionGrantsAccess(s, FUTURE, NOW)).toBe(true);
      expect(subscriptionGrantsAccess(s, PAST, NOW)).toBe(false);
    }
  });
  it("cancelled → yalnız gelecekteki expiry'ye kadar erişim", () => {
    expect(subscriptionGrantsAccess("cancelled", FUTURE, NOW)).toBe(true);
    expect(subscriptionGrantsAccess("cancelled", PAST, NOW)).toBe(false);
    expect(subscriptionGrantsAccess("cancelled", null, NOW)).toBe(false);
  });
  it("expired/refunded/revoked → asla erişim", () => {
    for (const s of ["expired", "refunded", "revoked"]) {
      expect(subscriptionGrantsAccess(s, FUTURE, NOW)).toBe(false);
    }
  });
  it("planFromEntitlement erişim yoksa free", () => {
    expect(planFromEntitlement({ plan: "family_4", subscription_status: "active", premium_until: FUTURE }, NOW)).toBe("family_4");
    expect(planFromEntitlement({ plan: "family_4", subscription_status: "refunded", premium_until: FUTURE }, NOW)).toBe("free");
    expect(planFromEntitlement(null, NOW)).toBe("free");
  });
});

describe("purchase verification", () => {
  it("desteklenen ürünler ve plan eşlemesi", () => {
    expect(isSupportedProduct("family_4_monthly")).toBe(true);
    expect(isSupportedProduct("hacker_product")).toBe(false);
    expect(productIdToPlan("family_5_monthly")).toBe("family_5");
    expect(productIdToPlan("nope")).toBeNull();
  });
  it("adapter yoksa NotConfigured (sahte başarı üretmez)", () => {
    expect(() => selectAdapter("ios", {})).toThrow(NotConfiguredError);
  });
  it("mock adapter ile doğrulama → entitlement upsert şekli", async () => {
    const mock: StoreAdapter = {
      async verify() {
        const v: VerifiedSubscription = {
          platform: "ios",
          productId: "family_4_monthly", plan: "family_4",
          originalTransactionId: "OT1", latestTransactionId: "LT1",
          status: "active", premiumUntil: FUTURE, environment: "sandbox",
        };
        return v;
      },
    };
    const a = selectAdapter("ios", { ios: mock });
    const v = await a.verify({ platform: "ios", productId: "family_4_monthly", receipt: "r" });
    const row = toEntitlementUpsert("user-1", v, NOW.toISOString());
    expect(row).toMatchObject({
      user_id: "user-1", plan: "family_4", platform: "ios", person_limit: 4,
      subscription_status: "active", original_transaction_id: "OT1", environment: "sandbox",
    });
  });
});

describe("cron secret", () => {
  it("timingSafeEqual", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
  it("beklenen yoksa veya yanlışsa reddet, doğruysa kabul", () => {
    expect(checkCronSecret("s3cr3t", "s3cr3t")).toBe(true);
    expect(checkCronSecret("wrong", "s3cr3t")).toBe(false);
    expect(checkCronSecret("s3cr3t", undefined)).toBe(false);
    expect(checkCronSecret(null, "s3cr3t")).toBe(false);
  });
  it("başlıktan secret çıkarma (Bearer / x-cron-secret)", () => {
    const h1: Record<string, string> = { authorization: "Bearer TOK" };
    expect(extractCronSecret((n) => h1[n.toLowerCase()])).toBe("TOK");
    const h2: Record<string, string> = { "x-cron-secret": "XX" };
    expect(extractCronSecret((n) => h2[n.toLowerCase()])).toBe("XX");
    expect(extractCronSecret(() => null)).toBeNull();
  });
});

describe("reminder uygunluk", () => {
  const pref: ReminderPrefLike = {
    push_enabled: true, email_enabled: true,
    remind_7d: true, remind_3d: true, remind_1d: true, remind_due_day: true, remind_overdue: true,
    hide_amount_in_notifications: true,
  };
  it("pencere etiketi ve açıklık", () => {
    expect(windowTag(7)).toBe("7d");
    expect(windowTag(0)).toBe("due");
    expect(windowTag(-1)).toBe("overdue");
    expect(windowTag(5)).toBeNull();
    expect(windowOpen(pref, 3)).toBe(true);
    expect(windowOpen({ ...pref, remind_3d: false }, 3)).toBe(false);
  });
  it("email tüm koşullar sağlanınca gönderilir; premium/doğrulama şart", () => {
    const base = { pref, email: "a@b.com", emailVerified: true, occurrenceOpen: true, windowOpen: true };
    expect(emailEligible({ ...base, hasPremium: true })).toBe(true);
    expect(emailEligible({ ...base, hasPremium: false })).toBe(false);
    expect(emailEligible({ ...base, hasPremium: true, emailVerified: false })).toBe(false);
    expect(emailEligible({ ...base, hasPremium: true, email: null })).toBe(false);
    expect(emailEligible({ ...base, hasPremium: true, occurrenceOpen: false })).toBe(false);
  });
  it("gövde mahremiyet tercihine göre tutarı gizler", () => {
    expect(reminderBody("Kart", 0, "₺100", true)).toBe("Kart — bugün.");
    expect(reminderBody("Kart", 0, "₺100", false)).toBe("Kart — bugün. Tutar: ₺100.");
    expect(reminderBody("Kart", -1, "₺100", true)).toBe("Kart — dün son gündü.");
  });
});

describe("hesap silme hane senaryosu", () => {
  it("yalnız üye → üyelik kaldırılır", () => {
    expect(resolveDeletion({ isOwner: false, otherMemberCount: 0 }).action).toBe("remove_membership");
  });
  it("owner + tek üye → hane silinir", () => {
    expect(resolveDeletion({ isOwner: true, otherMemberCount: 0 }).action).toBe("delete_household_and_data");
  });
  it("owner + başka üye + yeni owner yok → replacement gerekli (ok:false)", () => {
    const r = resolveDeletion({ isOwner: true, otherMemberCount: 2 });
    expect(r.action).toBe("needs_replacement_owner");
    expect(r.ok).toBe(false);
  });
  it("owner + başka üye + geçerli yeni owner → transfer sonra kaldır", () => {
    const r = resolveDeletion({
      isOwner: true, otherMemberCount: 1,
      replacementOwnerMemberId: "m2", replacementIsActiveMember: true, replacementIsSelf: false,
    });
    expect(r.action).toBe("transfer_then_remove");
    expect(r.ok).toBe(true);
  });
  it("yeni owner kendisi olamaz / aktif üye olmalı", () => {
    expect(resolveDeletion({ isOwner: true, otherMemberCount: 1, replacementOwnerMemberId: "self", replacementIsActiveMember: true, replacementIsSelf: true }).ok).toBe(false);
    expect(resolveDeletion({ isOwner: true, otherMemberCount: 1, replacementOwnerMemberId: "x", replacementIsActiveMember: false }).ok).toBe(false);
  });
});
