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
