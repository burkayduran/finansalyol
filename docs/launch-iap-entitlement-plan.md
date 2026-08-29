# Launch — Native IAP + Server-side Entitlement Planı (v2.2)

RevenueCat **kullanılmıyor**. Bu doküman, dev-build sonrası tamamlanacak native satın
alma entegrasyonunu ve premium gate'in server tarafına taşınmasını tarif eder. İstemci
tarafı hazır: `src/core/plan.ts`, `src/config/entitlements.tsx`, `src/lib/purchases.ts`.

## 1. Native IAP (StoreKit / Google Play Billing)

Bağlanma noktası: `src/lib/purchases.ts` (`startPurchase` / `restorePurchases`).
`PRODUCT_ID_TO_PLAN` eşlemesi ve `PLAN_PRODUCTS` zaten tanımlı.

Adımlar:
1. **Paket:** dev-build'de `react-native-iap` (veya `expo-in-app-purchases`) eklenir; app.json'a config plugin.
2. **Ürünler:** App Store Connect + Play Console'da abonelik ürünleri: `family_4_monthly`
   (₺159,99), `family_5_monthly` (₺199,99), `family_6_monthly` (₺239,99), `family_7_monthly` (₺279,99).
3. **purchase start:** `requestSubscription(product.productId)`.
4. **success:** `purchaseUpdatedListener` → makbuz/token'ı backend'e gönder.
5. **failure:** `purchaseErrorListener` → kullanıcıya sade hata.
6. **restore:** `getAvailablePurchases()` → backend doğrulama → entitlement.
7. **status:** periyodik `getAvailablePurchases()` + expiry kontrolü.
8. **entitlement update:** backend doğrulama başarılıysa `entitlements` satırı yazılır;
   istemci `useEntitlement().refresh()` çağırır. `finishTransaction()`.

Prod kabul: satın alma "yakında" demez; gerçek store sheet açılır; başarı → premium açılır;
restore çalışır; iptal/expire → `subscription_status`/`premium_until` ile erişim kapanır.

## 2. Backend makbuz doğrulama (Supabase Edge Function)

- Edge Function `verify-receipt`: platform + receipt/token alır, Apple/Google ile doğrular,
  `entitlements`'a (service-role) `plan`, `subscription_status`, `premium_until`,
  `platform`, `product_id`, `last_receipt_check_at` yazar.
- İstemci **asla** entitlements'a yazmaz (RLS: yalnız kendi satırını okur — bkz. 0013).

## 3. Server-side entitlement / RLS (0015)

Salt-okur yardımcılar deploy edildi (uygulamayı bozmaz):
`current_plan(uid)`, `has_active_premium(uid)`, `plan_person_limit(uid)`.

Zorlama, **receipt-verify entitlements'ı doldurmaya başladıktan sonra** açılır (0015
içindeki template'ler). Sıra:
1. `assets` / `cash_flows` insert politikaları → `has_active_premium(auth.uid())`.
2. `persons` insert trigger → `plan_person_limit` ile kişi limiti.
3. reminder-cron → mail gönderimini entitlements join'i ile premium'a sınırla.

> ⚠️ Bu template'ler CANLIDA erken açılırsa, entitlements satırı olmayan mevcut/dev
> kullanıcılar premium tablolara yazamaz. Önce (1) gerçek IAP + (2) receipt-verify
> yazımı canlı olmalı; sonra zorlama açılır. Böylece UI-gate → server-gate geçişi güvenli.
