# App Store Privacy & Google Play Data Safety — Beyan Taslağı

Gerçek kod davranışına göre hazırlanmıştır. Formları doldururken bunu esas alın.

## Toplanan veri türleri (gerçek davranış)

| Tür | Toplanıyor? | Amaç | Kullanıcıya bağlı? | Not |
|---|---|---|---|---|
| Contact Info (e-posta) | Evet | Hesap/kimlik, (planlı) e-posta hatırlatma | Evet | Supabase auth |
| Name (ad-soyad) | Evet | Profil, kişi kartları | Evet | Kullanıcı girer |
| User ID | Evet | Hesap, analitik kimliği | Evet | Supabase user_id |
| Purchases | Evet (IAP devreye girince) | Abonelik/entitlement | Evet | Store + entitlements |
| Financial Info | Evet | Borç/varlık/ödeme takibi (uygulamanın amacı) | Evet | Kullanıcı girer; 3. tarafla PAYLAŞILMAZ |
| User Content (not/etiket) | Evet | Kayıt açıklamaları | Evet | Serbest metin |
| Diagnostics (crash) | Sentry init edilirse | Hata izleme | Kısmen | PII gönderilmez |
| Usage Data | PostHog key varsa | Ürün analitiği | Evet (user_id) | Nötr olaylar; tutar/PII yok |
| Device ID / Push Token | Evet | Push bildirimi | Evet | Expo push token |

## Tracking (izleme)
- Reklam/çapraz-uygulama izleme **YOK**. Üçüncü taraf reklam SDK'sı yok.
- Analitik yalnız ürün içi; PostHog EU. ATT gerektiren "tracking" yapılmıyor.

## Analytics'e ASLA gönderilmeyen (koddan doğrulandı — `src/lib/analytics.ts`)
E-posta, telefon, ad/soyad, hane/kişi adı, borç açıklaması, **tutarlar**, serbest not,
davet kodu, satın alma receipt/token, banka adı + tanımlayıcı. Yalnız `user_id` + nötr olay adları.

## Veri silme
- Uygulama içinden hesap silme talebi mevcut; **gerçek silme worker'ı** (Edge Function)
  devreye alınmalı (bkz. PRODUCTION_READINESS Aşama 5). Google Play için giriş gerektirmeyen
  public hesap-silme sayfası gerekir (`/hesap-silme`, MANUAL_ACTIONS §5).

## Açık kalan (form doldurmadan önce netleştir)
- IAP canlı mı? (Purchases beyanı buna bağlı.)
- Sentry/PostHog production'da init ediliyor mu? (Diagnostics/Usage beyanı buna bağlı.)
- E-posta gönderimi açıldı mı? (Contact Info kullanım amacı buna bağlı.)
