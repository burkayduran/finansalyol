# CLAUDE.md — Borç Takip Aile Sürümü · mühendislik rehberi

Bu dosya depo üzerinde çalışan herkes (insan/AI) için mimari ve değişmez kuralları
özetler. Ürün yönü: [`docs/aile-surumu-revize.md`](docs/aile-surumu-revize.md).

## 0. Konumlandırma

Bulut tabanlı **aile** uygulaması: tüm hane borç/ödeme/birikimi tek panoda + push/
e-posta hatırlatma. Borç-azaltma içgörüsü **yan özellik** (borcun içinde sekme), vitrin değil.

## 1. Görünmez prensipler (ekrana YAZILMAZ, hesapta uygulanır)

1. **Tavan ≠ gerçek.** Faiz tahmini TCMB üst sınırıyla; UI'da yalnız küçük "≈ tahmini"
   rozeti + dokununca "kendi oranını girersen daha doğru" notu.
2. **Yargı yok.** Asgari-tuzağı sıcak ve suçlamasız anlatılır.
3. **Az soru.** Zorunlu alan minimumda; opsiyoneller akışı durdurmaz.

Bu prensipler iç dildir; sloganlaştırılıp ekrana basılmaz. Kullanıcıya görünen dil
sıcak ve azdır (bkz. spec §"Kullanıcıya görünen dil").

## 2. Para ve format

- Para **her zaman `number`** (DB'de `numeric`), UI'da `tr-TR`.
- Tek kaynak: `src/core/format.ts` (`parseTRYInput`, `formatTRY`, `formatPercent`).
- Çekirdek motor (`src/core/`) saf ve framework-bağımsız; hem RN hem Edge Function kullanır.

## 3. İki ayrı oran/asgari sistemi — KARIŞTIRMA

| Sistem | Bazı | Kaynak | Kod |
|---|---|---|---|
| **Faiz tahmini** | dönem borcu | TCMB azami/tavan | `src/core/rateConfig.ts` |
| **Asgari ödeme** | kart limiti | BDDK %20/%40 | `src/core/minimum.ts` |

Kullanıcı oranı (`user_monthly_rate`) fallback'i **ezer** (`resolveMonthlyRate`).
TCMB tablosu BETA: oran değişince elle güncellenir (`RATE_SOURCE.lastCheckedAt`).

## 4. Hane modeli & güvenlik (en kritik)

- **Üye** (`profiles` ↔ auth.users) ile **kişi** (`persons`, borç bağlanır, üye olmak
  zorunda değil) ayrı. `persons.linked_member_id` ile bağlanır.
- **RLS her tabloda açık.** Erişim `is_household_member(household_id)` ile; üye yalnız
  üyesi olduğu haneyi görür. Yeni hane-kapsamlı tablo eklerken RLS politikasını UNUTMA.
- Yumurta-tavuk durumları (ilk insert) `security definer` RPC ile çözülür
  (`create_household`, `accept_invite`) — `supabase/rpc.sql`.
- İstemci **asla** service-role key tutmaz; yalnız anon key (`EXPO_PUBLIC_*`).

## 5. Hatırlatma motoru (`supabase/functions/reminder-cron`)

- Günlük cron (pg_cron → Edge Function). Service-role ile tüm haneleri tarar.
- Push: gün-önce (`days_before`) + son gün. E-posta: haftalık özet (`digest_weekday`).
- **Idempotency zorunlu:** her gönderim `reminders_log`'a unique kayıt; çift gönderim yok.
- Edge Function Deno'dur; `src/core`'u import etmez (ayrı runtime) — kritik küçük
  mantık (asgari, tarih) fonksiyon içinde tekrarlanır. Değişirse iki yeri de güncelle.

## 5.1 Varlık/fiyat & FX — manuel-önce, oto katmanlı

- **Manuel-önce:** fiyatlı her varlıkta kullanıcı `buy_price`/`last_price` elle girer.
  Oto-fiyat bunun *üstüne* eklenen katmandır; bozulsa bile kâr/zarar manuel veriyle çalışır.
  "Oto-fiyat garantili günlük" vaadi YOK.
- Değerleme & K/Z: `src/core/assets.ts`. FX dönüşümü TCMB **alış** (`forex_buying`).
- Crons: `fx-cron` (TCMB today.xml → `fx_rates`, açık/güvenilir), `price-cron`
  (kripto = BtcTurk, güvenilir; fon/hisse/altın **best-effort, izole** — biri kırılırsa
  diğerini etkilemez). reminder-cron deseni örnek alınır.
- Taksitli borçta **kalan borç elle girilmez**; toplam tutar + taksit + sayı + ilk
  tarihten türetilir (`src/core/installment.ts`). Dashboard toplam/kişi/projeksiyon
  `outstandingBalance` kullanır, ham `balance` değil.

## 6. İstemci mimarisi

- **expo-router** file-based. `app/_layout.tsx` oturum + hane bekçisidir
  (oturum yok → `sign-in`; hane yok → `onboarding`).
- Oturum/aktif hane: `src/providers/SessionProvider.tsx`.
- Pano verisi ve türetilmiş değerler: `src/hooks/useHousehold.ts` (toplam borç/varlık/
  net, kişi kırılımı, yaklaşan ödemeler).
- Paylaşılan UI `src/components/ui.tsx`, renkler `src/theme.ts`.

## 7. Env & gizli anahtarlar

- İstemci: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env`).
- Edge Function: `RESEND_API_KEY`, `RESEND_FROM` (`supabase secrets set`).
- `.env` ve `supabase/.env.local` **commit edilmez** (`.gitignore`).

## 8. Faz kilidi

**F1 (VAR):** auth · hane + üye/kişi + davet · borç/ödeme/varlık girişi · aile panosu ·
push + e-posta hatırlatma · asgari-tuzağı içgörüsü (basit).

**F2 (YOK):** çığ/kartopu sıralama · koçluk add-on · abonelik · raporlar · MKK import.
**F3:** banka entegrasyonu (lisanslı partner).

> ⚠️ Mevzuat: borç-azaltma = "koçluk/eğitim", "yatırım tavsiyesi" değil. Komisyonlu
> ürün önerisi mevzuata tabi — ürünleşmeden önce hukuk onayı.

## 9. Geliştirme

```bash
npm install
npm run start      # Expo dev server
npm test           # vitest — çekirdek motor testleri
npm run typecheck  # tsc --noEmit
```

Yeni hesap kuralı eklerken önce `src/core/__tests__/engine.test.ts`. DB değişikliği
`supabase/schema.sql` + RLS + (gerekirse) `rpc.sql`; tipleri `src/lib/database.types.ts`'e yansıt.

## 10. Sahiplik · ödeme olayları · aksiyon panosu (MVP Revizyon v1.1)

- **Sahiplik:** her finansal kayıtta `owner_type` ('person'|'household') + `person_id`.
  Ortak kayıt bilinçli olarak `owner_type='household'` (null "belirsiz" değildir).
  `OwnerSelect` ("Kime ait?") debts/assets/cash_flows/payments formlarında.
- **Payment occurrence:** beklenen ödemeler `payment_occurrences` (pending/partial/paid/
  overdue/skipped). Motor: `src/core/paymentOccurrences.ts` (generate / mandatory / status).
  İstemci servisi `src/lib/occurrences.ts` (ensure idempotent + recordPayment + skip).
  `payments` tablosu işlem geçmişi olarak kalır; ödeme kaydı occurrence + borç bakiyesi +
  (taksitli) `remaining_installment_count`'u günceller, kalan 0 ise `is_active=false`.
- **Kredi/taksitli KMH:** kullanıcı mevcut durumu girer — güncel kalan borç + aylık taksit +
  kalan taksit + sıradaki ödeme tarihi. Normal KMH taksitli değildir.
- **Borç alan adları:** yeni motorlar `current_balance` / `monthly_installment` /
  `remaining_installment_count` / `next_due_date` kullanır; eski alanlar (balance/installment/
  term_count/first_installment_date) geriye uyum için durur.
- **Hatırlatma:** cron artık `payment_occurrences` üzerinden; yalnız pending/partial ve
  7/3/1/son gün/gecikme penceresi + üye kapsamı (own/household/all). paid/skipped → bildirim yok.
- **Navigasyon (v1.2):** Pano · Kişiler · **Ekle (hub)** · Takvim · Ayarlar + sağ üst "+ Ekle".
  Varlıklar bottom tab değil; `/assets` rotası (Pano "Toplam varlık", Ekle hub, kişi detay).
  Pano aksiyon odaklı: bu ay ödenecek + ödeme progress'i (ödendi/kalan), en acil ödemeler
  (Ödeme kaydet + "Bu ay atla"), kişi kartları (net durum), gelecek 3 ay; grafikler en altta.
- **Çoklu taksit:** ödeme ≥ taksit ise `floor(amount/installment)` taksit düşer
  (`installmentsCoveredByPayment`); next_due_date o kadar ay ilerler. Projection ufku 12 ay.
- **BankSelect** `{code, name}` döndürür (Diğer → code "other"); debts.bank_code/bank_name.
- **Kişi arşivleme:** silme yerine `persons.is_archived` (finansal verisi olan kişi silinmez).
- **Dil:** pazarlama metni ekranlara yazılmaz ("faiz tuzağı", "bilanço", "yargısız merdiven"
  vb. yok); sade ürün dili.
