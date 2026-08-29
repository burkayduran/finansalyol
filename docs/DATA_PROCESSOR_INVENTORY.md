# Veri İşleyen Envanteri (Data Processor Inventory)

Koddan tespit edilen, gerçekten kullanılan sağlayıcılar. KVKK m.9 (yurt dışı aktarım) için
gereken sözleşme/güvenceler **kodla sağlanamaz** — bkz. `MANUAL_ACTIONS.md` §7.

## Supabase (Auth + Postgres + Storage yok)
- **Amaç:** Kimlik doğrulama, veritabanı (borç/varlık/ödeme/hane), RLS, Edge Functions, cron.
- **Veri kategorileri:** e-posta, ad-soyad (profil), finansal kayıtlar, kişi adları, push token, tercihler.
- **Zorunlu mu:** Zorunlu (uygulamanın çekirdeği).
- **Bölge:** Proje bölgesine göre (AB tercih edilir; kurulum sırasında seçilir).
- **Yurt dışı aktarım:** Proje AB dışıysa var → uygun güvence gerekir.
- **Hukuki mekanizma:** Veri işleyen sözleşmesi (DPA) + gerekiyorsa açık rıza/uygun güvence.
- **Saklama:** Uygulama verisi kullanıcı silene kadar; silme = hesap-silme akışı.
- **Silme yöntemi:** `on delete cascade` + hesap-silme worker (bkz. PRODUCTION_READINESS).
- **Env:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Expo (Push + Build/OTA)
- **Amaç:** Push bildirimi (Expo Push), build/dağıtım (EAS).
- **Veri kategorileri:** Expo push token, cihaz bilgisi (bildirim için).
- **Zorunlu mu:** Push için zorunlu; kullanıcı bildirimi kapatabilir.
- **Bölge:** ABD.
- **Yurt dışı aktarım:** Var.
- **Hukuki mekanizma:** İşleyen ilişkisi + aydınlatma.
- **Saklama:** Token geçersiz olunca (`DeviceNotRegistered`) temizlenmeli (planlı).
- **Env:** — (Expo hesabı/EAS).

## Apple (App Store, Push APNs, IAP)
- **Amaç:** Dağıtım, APNs push, In-App Purchase (planlı).
- **Veri kategorileri:** satın alma/abonelik, cihaz push kimliği.
- **Zorunlu mu:** iOS dağıtımı için zorunlu.
- **Bölge:** ABD/global.
- **Yurt dışı aktarım:** Var.
- **Hukuki mekanizma:** Apple DPA / platform şartları.

## Google (Play, FCM, Billing)
- **Amaç:** Dağıtım, FCM push, Play Billing (planlı).
- **Veri kategorileri:** satın alma/abonelik, cihaz push kimliği.
- **Zorunlu mu:** Android dağıtımı için zorunlu.
- **Bölge:** ABD/global. **Yurt dışı aktarım:** Var. **Mekanizma:** Google DPA.

## Resend (E-posta) — HENÜZ AKTİF DEĞİL
- **Amaç:** İşlemsel e-posta / hatırlatma (devreye alınırsa).
- **Veri kategorileri:** e-posta adresi, ödeme hatırlatma içeriği.
- **Zorunlu mu:** İsteğe bağlı (Premium mail). Şu an gönderim YOK.
- **Bölge:** ABD. **Yurt dışı aktarım:** Var. **Mekanizma:** DPA.
- **Env:** `RESEND_API_KEY`, `RESEND_FROM`.

## PostHog (Analytics) — opsiyonel, key varsa
- **Amaç:** Ürün analitiği (olay bazlı). PII/tutar GÖNDERİLMEZ (bkz. STORE_PRIVACY_DECLARATIONS).
- **Veri kategorileri:** user_id (Supabase), nötr olay adları (owner_type/kategori gibi).
- **Zorunlu mu:** İsteğe bağlı; key yoksa yalnız dev console.
- **Bölge:** EU host (`eu.i.posthog.com`). **Yurt dışı aktarım:** AB → düşük risk.
- **Mekanizma:** DPA; opsiyonel analitik açık rızaya bağlanacaksa rıza yönetimi (planlı).
- **Env:** `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`.

## Sentry (Hata izleme) — bağımlılık mevcut
- **Amaç:** Çökme/hata izleme (init edilirse).
- **Veri kategorileri:** hata stack, cihaz/uygulama sürümü. PII gönderilmemeli.
- **Zorunlu mu:** İsteğe bağlı.
- **Bölge:** ABD/AB (org ayarına göre). **Yurt dışı aktarım:** olası. **Mekanizma:** DPA.
- **Not:** `@sentry/react-native` `package.json`'da; init/DSN yapılandırması ürün kararına bağlı.

## TCMB / BtcTurk (fiyat & kur) — sunucu tarafı cron
- **Amaç:** Döviz kuru (TCMB today.xml), kripto fiyatı (BtcTurk). **Kişisel veri işlemez** (kamuya açık fiyat).
- **Zorunlu mu:** Değerleme için işlevsel; kişisel veri aktarımı yok.
