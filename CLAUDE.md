# CLAUDE.md — Borç Takip 0A mühendislik rehberi

Bu dosya, depo üzerinde çalışan herkes (insan veya AI) için tasarım kurallarını
ve mimariyi özetler. Ürün/akış spesifikasyonu: [`docs/akis-spec-v0.2.md`](docs/akis-spec-v0.2.md).

## 0. Değişmez kurallar (akışın her yerinde)

1. **Tavan ≠ gerçek.** Tahminler TCMB azami (tavan) oranıyla. Dil her zaman
   "yaklaşık / tavan orana göre". Kesin kazanç iddiası yok.
2. **Yargı yok, merdiven var.** Skor/bölge/damga yok. Her uyarı bir sonraki
   somut adıma bağlanır.
3. **Wow opsiyonel alana takılmaz.** APR ve ekstra tutar boşsa bile akış ve
   içgörü devam eder (fallback / illüstratif değerle).

## 1. Para ve format

- Para **her zaman `number`** (TRY) olarak saklanır; UI'da `tr-TR` formatlanır.
- Tek kaynak: `src/core/format.ts` (`parseTRYInput`, `formatTRY`, `formatPercent`).
- Koda gömülü sayısal örnek yok; sample veri `src/data/sample.ts` içinde ve
  `mode: "sample"` ile işaretli.

## 2. İki ayrı oran/asgari sistemi — KARIŞTIRMA

| Sistem | Bazı | Kaynak | Kod |
|---|---|---|---|
| **Faiz tahmini** | dönem borcu (statement) | TCMB azami/tavan | `src/core/rateConfig.ts` |
| **Asgari ödeme** | kart limiti | BDDK %20/%40 | `src/core/minimum.ts` |

Faiz tieri dönem borcuna, asgari tieri kart limitine bakar. Bunlar bağımsızdır.

## 3. Üçlü maliyet ayrımı (§8)

`Asgari (kural)` · `Faiz tahmini (tavan)` · `Gerçek maliyet (banka + BSMV/KKDF)`.
UI'da `src/components/Disclaimers.tsx` ile net ayrılır. Birbirine karışırsa güven gider.

## 4. APR fallback

- Seed'li tablo `src/core/rateConfig.ts` (`CREDIT_CARD_PURCHASE_TIERS`,
  `CASH_ADVANCE_KMH_RATE`). **Admin UI yok (0A).**
- Kullanıcı oranı (`userMonthlyRate`) fallback'i **ezer** (`resolveMonthlyRate`).
- **BETA:** TCMB oranı değişince tablo elle güncellenmeli. `RATE_SOURCE.lastCheckedAt`
  UI'da küçük gösterilir.

## 5. Plan motoru (akış spec §5–6 · `src/core/payoff.ts`)

İki **ayrı** blok:

- **Blok A — Zorunlu:** kart asgarileri + kredi taksitleri + kullanıcı minimumları.
  Sıralama anahtarı: **son ödeme günü (artan)**. Amaç: gecikmeyi önle.
- **Blok B — Ekstra:** kalan bütçe. Sıralama anahtarı: **seçilen strateji (tek anahtar)**.
  - `avalanche` → aylık oran (azalan)
  - `snowball` → bakiye (artan)
- **KMH:** regüle asgarisi yok → her zaman **ekstra** hedefi, zorunlu değil.
- **"Neden" metni** asla elle yazılmaz; motordan üretilir (`extraReason`,
  `minimumReason`) ki gösterilen sıra ile gerekçe çelişmesin.

> Not: 0A'da çekirdek mantık `src/core/` altındadır (spec'teki `packages/core/payoff`
> referansının 0A karşılığı). Monorepo'ya geçişte `src/core` → `packages/core` taşınabilir.

## 6. Veri & gizlilik

- Local-first, **auth yok, sync yok**. Tek kaynak `localStorage` (`src/core/storage.ts`).
- Export/import JSON ile (`exportState` / `importState`).
- PWA: `public/manifest.webmanifest` + `public/sw.js` (offline-first app shell).

## 7. Event / metrik temizliği (§9–10)

- `src/analytics/events.ts`. `real_*` ve `sample_*` event'leri **ayrı** tutulur.
- Funnel ve north-star **yalnız `real_*`** event'lerden okunur.
- 0A'da backend yok; event'ler local buffer + console'a yazılır.

## 8. 0A kapsam kilidi

**VAR:** kapısız giriş · tek borçla onboarding · gerçek/örnek ayrımı · TCMB tavan
fallback · kullanıcı override · BDDK asgari · ilk içgörü · zorunlu blok · ekstra blok ·
çığ/kartopu v1 · son ödeme uyarısı · local-first PWA · export/import.

**YOK (sonraki faz):** sağlık skoru · tam koçluk · Supabase sync · hane daveti ·
MKK import · lead-gen · admin UI · gecikme faizi + BSMV/KKDF detay · banka entegrasyonu.

## 9. Geliştirme

```bash
npm install
npm run dev        # Vite dev server
npm test           # vitest — çekirdek motor testleri
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
```

Çekirdek mantık (`src/core/`) saf ve test edilebilir tutulur; React katmanı yalnız
onu gösterir. Yeni hesap kuralı eklerken önce `src/core/__tests__/engine.test.ts`.
