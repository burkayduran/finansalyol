# Borç Takip — Aile Sürümü

> **Ailenizin parası, tek ekranda.**
> Borçlar, ödemeler, birikimler — hep birlikte görün; biz de yaklaşınca hatırlatalım.

Bir ailenin (eş, anne, baba… kim varsa) tüm **borçlarını, ödemelerini ve birikimlerini
tek panoda** gösteren bulut tabanlı mobil uygulama. Son ödeme günü yaklaşınca **push +
e-posta** ile hatırlatır. Borç-azaltma/asgari-tuzağı içgörüleri her borcun içinde
**isteğe bağlı bir sekme** — vitrin değil, yan özellik.

Yön dokümanı: [`docs/aile-surumu-revize.md`](docs/aile-surumu-revize.md).

---

## Çekirdek ekran (kalp)

**Aile panosu:** toplam borç (kişi kırılımlı), toplam varlık, net durum ve **yaklaşan
ödemeler**. Onboarding "hane kur → ilk hesabını ekle → aileni davet et" üzerine kurulu.

## Hane modeli

- **Üye:** giriş yapan aile ferdi (auth.users / `profiles`).
- **Kişi:** borç/varlık bağlanan ama uygulamayı kullanmak zorunda olmayan anne/baba.
- Biri ikisi birden de olabilir (`persons.linked_member_id`).
- Tüm veri **hane bazında RLS** ile korunur — üye yalnızca üyesi olduğu haneyi görür.

## Hatırlatma

- **Push (birincil):** borç başına, ayarlanan gün önce + son gün.
- **E-posta (ikincil):** haftalık "bu haftanın ödemeleri" özeti.
- Varsayılan ikisi de açık; kullanıcı `Ayarlar`'dan kanalları yönetir.
- Motor: günlük cron → **Supabase Edge Function** (`supabase/functions/reminder-cron`)
  → Expo Push + Resend e-posta. Idempotency `reminders_log` ile.

## Teknoloji

| Katman | Seçim |
|---|---|
| Mobil | **Expo (React Native)** + expo-router + expo-notifications |
| Bulut | **Supabase** — Auth + Postgres + RLS |
| Hatırlatma | Supabase Scheduled Edge Function (Deno) + pg_cron |
| E-posta | Resend |
| Çekirdek hesap | Saf TypeScript (`src/core`), framework'ten bağımsız |

## Klasör yapısı

```
app/                         # expo-router ekranları (file-based routing)
├── _layout.tsx              # oturum + hane yönlendirme bekçisi
├── sign-in.tsx              # giriş / kayıt
├── onboarding.tsx           # hane kur / davetle katıl
├── add-debt.tsx · add-asset.tsx
├── debt/[id].tsx            # borç detay + İçgörü sekmesi (asgari tuzağı)
└── (tabs)/                  # Pano · Aile · Ayarlar
src/
├── core/                    # saf hesap motoru (TCMB tavan, BDDK asgari, faiz, tarih)
├── lib/                     # supabase client, db tipleri, push kaydı
├── hooks/useHousehold.ts    # pano verisi + türetilmiş değerler
├── providers/               # oturum + aktif hane bağlamı
└── components/ · theme.ts
supabase/
├── schema.sql               # tablolar + RLS
├── rpc.sql                  # create_household / accept_invite / household_summary
└── functions/reminder-cron/ # günlük hatırlatma Edge Function
```

## Kurulum

```bash
npm install
cp .env.example .env           # Supabase URL + anon key gir

# Supabase şeması
supabase db reset              # ya da SQL editöründe schema.sql + rpc.sql çalıştır

npm run start                  # Expo dev server (Expo Go ile telefonda aç)
npm run typecheck
npm test                       # çekirdek motor testleri (vitest)
```

Hatırlatma motoru kurulumu: [`supabase/functions/reminder-cron/cron.md`](supabase/functions/reminder-cron/cron.md).

## Fazlar

- **F1 (bu sürüm):** aile panosu + hatırlatma (bulut). Auth + hane + davet, borç/ödeme/
  varlık girişi, push + e-posta hatırlatma, asgari-tuzağı içgörüsünün basit hali.
- **F2:** çığ/kartopu, koçluk add-on, abonelik, raporlar, MKK varlık import.
- **F3:** banka entegrasyonu (lisanslı partner) — asıl moat.

## Görünmez prensipler (ekrana yazılmaz, hesapta uygulanır)

Tavan ≠ gerçek (tahminler TCMB üst sınırıyla, "≈ tahmini" rozetiyle) · yargısız ton ·
az soru. Bu prensipler üründe his olarak yaşar, kullanıcıya slogan diye gösterilmez.

> ⚠️ **Mevzuat:** Borç-azaltma içeriği "koçluk/eğitim" olarak konumlanır, "yatırım
> tavsiyesi" değil (SPK lisanslı alan). Komisyonlu ürün önerisi mevzuata tabidir.

Mühendislik kuralları: [`CLAUDE.md`](CLAUDE.md).
