# MANUAL_ACTIONS — Kod dışı, dış hesap/secret gerektiren adımlar

Bu dosya, repository içinde **kodla yapılamayan / yapılmaması gereken** (secret, mağaza
hesabı, dış dashboard, sözleşme) işleri listeler. Hiçbiri kodda taklit edilmemiştir.

## 1. EAS / Build kimliği
- `app.json` içinden placeholder `extra.eas.projectId` **kaldırıldı**. Gerçek değeri üret:
  - `npx eas init` (EAS hesabıyla giriş yaptıktan sonra) → `projectId` otomatik yazılır,
    veya `eas.json`/CI ortam değişkeni ile sağla.
- iOS `bundleIdentifier` = `com.finansalyol.app`, Android `package` = `com.finansalyol.app`
  (dondurulmuştur — ilk submit'ten sonra DEĞİŞTİRME).
- Sürüm artışı: `app.json ios.buildNumber` / `android.versionCode` ve `eas.json`
  production `autoIncrement`. İlk submit sonrası CI'da otomatik artacak.

## 2. Supabase secret'ları (asla repoya yazma)
`supabase secrets set` ile:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Edge Function'lar için)
- `RESEND_API_KEY`, `RESEND_FROM` (e-posta gönderimi devreye alınırsa)
- İstemci `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` (opsiyonel)

## 3. Native In-App Purchase (RevenueCat YOK)
Kod tarafı hazır: `src/core/plan.ts` (PLAN_PRODUCTS/product_id), `src/lib/purchases.ts`
(bağlanma seam'leri). Dev-build sonrası tamamla:
- `react-native-iap` (veya `expo-in-app-purchases`) ekle + config plugin.
- App Store Connect + Google Play Console'da abonelik ürünleri:
  `family_4_monthly` (₺159,99), `family_5_monthly` (₺199,99), `family_6_monthly` (₺239,99),
  `family_7_monthly` (₺279,99). Fiyatlar mağazadan döndürülüp gösterilecek.
- **Apple App Store Server API** anahtarı (.p8) + issuer/key id; **App Store Server Notifications v2** endpoint.
- **Google Play Developer API** service account + **RTDN** (Pub/Sub) konusu.
- Edge Function `verify-receipt` (yazılacak): makbuz/token doğrular → `entitlements` (service-role) idempotent yazar.
- Doğrulama canlı olmadan **server-side premium zorlaması (0015 template'leri) AÇILMAZ**.

## 4. E-posta (Resend) — devreye alınacaksa
- Resend hesabı + doğrulanmış gönderim domaini + `RESEND_API_KEY`/`RESEND_FROM`.
- reminder-cron'a gerçek gönderim + `reminders_log` claimed/sending/sent/failed durum modeli eklenmeli
  (şu an sadece push). Devreye alınmayacaksa README'deki e-posta vaadi zaten "gönderilmiyor" olarak işaretlendi.

## 5. Public web sayfaları (Google Play/App Store zorunlu)
Aşağıdaki URL'ler production'da **HTTP 200** dönmeli (release testine eklenmeli):
- `/legal/gizlilik`, `/legal/kvkk`, `/legal/kosullar`, `/hesap-silme`
- `brand.ts.urls` bu domaine göre güncellenmeli. Hesap silme sayfası **giriş gerektirmeden**
  talep alabilmeli (Google Play "app dışı hesap silme" gerekliliği).

## 6. Auth / deep link
- Supabase Dashboard → Auth → URL Configuration → Redirect URLs: `finansalyol://reset-password` ekle.
- E-posta doğrulama şablonları (Supabase) marka ile güncellenmeli.

## 7. KVKK / hukuki (kod dışı)
- KVKK m.9 yurt dışı aktarım için sağlayıcılarla veri işleme sözleşmeleri / uygun güvence
  (bkz. `docs/DATA_PROCESSOR_INVENTORY.md`). Bu sözleşmeler kodla sağlanmış gibi gösterilemez.
- Nihai hukuki metinlerin (Gizlilik/KVKK/Koşullar) son sürümleri hukukça onaylanıp hem uygulama
  ekranlarına hem public web'e konmalı; sürüm string'leri `src/lib/legal.ts LEGAL_VERSIONS` ile eşlenmeli.

## 8. Store privacy beyanları
- App Store Privacy & Google Play Data Safety formları: `docs/STORE_PRIVACY_DECLARATIONS.md`'e göre doldur.

## 8b. v2.4 — Edge Function deploy, secret'lar, IAP native, rollout (KOD HAZIR)

**Edge Functions (deploy):** `supabase functions deploy delete-account verify-purchase reminder-cron fx-cron price-cron request-account-deletion confirm-account-deletion`

**Secret'lar (`supabase secrets set ...`):**
- `CRON_SECRET` — güçlü rastgele değer. Cron çağrılarında `Authorization: Bearer <CRON_SECRET>`
  veya `x-cron-secret` başlığı zorunlu (reminder/fx/price-cron artık secret'sız 401 döner).
  pg_cron/scheduler job'larını bu başlıkla + `POST` metoduyla çağıracak şekilde güncelle.
- `RESEND_API_KEY`, `RESEND_FROM` — e-posta (reminder + hesap silme doğrulama). Yoksa e-posta
  gönderilmez (NOT_CONFIGURED), uygulama bozulmaz.
- `PUBLIC_CONFIRM_URL` — `confirm-account-deletion` fonksiyonunun public URL'i
  (ör. `https://<ref>.functions.supabase.co/confirm-account-deletion`).
- IAP doğrulama (gerçek): `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_PRIVATE_KEY` (App Store Server API),
  `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PACKAGE_NAME` (Play Developer API). Yoksa `verify-purchase`
  `NOT_CONFIGURED` döner (SAHTE başarı üretmez). Gerçek doğrulama gövdesi (App Store Server API /
  Play Developer API çağrıları) bu credential'larla `verify-purchase/index.ts` içindeki adapter
  TODO'larına eklenecek + Apple ASSN v2 / Google RTDN webhook'ları bağlanacak.

**Native IAP build:** `react-native-iap` eklendi (package.json). Dev-build gerekir:
- `app.json` plugins'e IAP config plugin'i / `expo-build-properties` ekle; `eas build` ile dev/prod build al.
- App Store Connect + Play Console'da abonelik ürünleri (family_4..7_monthly) tanımlı olmalı.
- Expo Go'da native IAP çalışmaz; `useIap()` bu durumda güvenli fallback verir.
- Dev override: yalnız `__DEV__` + `EXPO_PUBLIC_IAP_DEV_OVERRIDE=1` ise yerel plan (test amaçlı).

**Server-side premium enforcement (kontrollü rollout):**
- Migration 0022 restrictive politikaları + kişi-limit trigger'ı `enforcement_on()` bayrağına bağlı.
- Bayrak `app_config` tablosunda (`server_entitlement_enforcement_enabled`), varsayılan `false`
  (mevcut davranış korunur). YALNIZ verify-purchase + receipt doğrulama canlıya alınıp entitlements
  gerçek dolmaya başladıktan SONRA `true` yap (service-role ile):
  `update public.app_config set value='true' where key='server_entitlement_enforcement_enabled';`

**pg_cron job örneği (secret başlıklı):**
`select cron.schedule('reminders','0 6 * * *', $$ select net.http_post('https://<ref>.functions.supabase.co/reminder-cron', '{}'::jsonb, headers:='{"Authorization":"Bearer <CRON_SECRET>","Content-Type":"application/json"}'::jsonb) $$);`

## 8c. Public web deploy
`web/` altındaki statik sayfaları HTTPS host'a deploy et; `/legal/gizlilik`, `/legal/kvkk`,
`/legal/kosullar`, `/hesap-silme` HTTP 200 dönmeli. `hesap-silme.html` içindeki `__FUNCTIONS_BASE__`
yer tutucusunu gerçek Functions URL'i ile değiştir. `src/config/brand.ts urls` domaini güncelle. (bkz. `web/README.md`)

## 9. Bağımlılık / güvenlik güncellemeleri
- `npm audit` 52 açık bildiriyor (çoğu transitive/dev). Expo SDK yükseltmesi (SDK 51 → güncel)
  native build + cihaz testi gerektirir; bu ortamda güvenle doğrulanamadığından **yapılmadı**.
  Ayrı bir branch'te `npx expo install --fix` + `npx expo-doctor` ile kontrollü yükseltin.
