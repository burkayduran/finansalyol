# Borç Takip 0A

> **Borcunu gör. Önceliğini bil. Faiz tuzağından çık.**
> Kredi kartı, KMH ve kredi borçlarını gir; bu ay neyi önce ödemen gerektiğini 2 dakikada gör.

Local-first, kayıtsız (auth yok, sync yok) bir borç önceliklendirme PWA'sı. Hedef:
kullanıcı ilk 5 dakikada *"bu benim derdimi gördü"* desin. 0A'nın hipotezi —
**borçtan-çıkış içgörüsü, kullanıcıyı biraz manuel girişe katlanacak kadar etkiliyor mu?**

İllüstratif tüm sayılar koda gömülü değildir. Para her zaman `numeric`, gösterim `tr-TR`.

---

## Ne yapar?

5 ekranlık akış (detay: [`docs/akis-spec-v0.2.md`](docs/akis-spec-v0.2.md)):

1. **Sert konumlandırma** — kapısız giriş. `İlk borcumu ekle` / `Örnek veriyle dene`.
2. **Tek borç girişi** — sadece bir borç. Faiz oranı *sorulmaz* (TCMB tavanıyla tahmin).
3. **İlk içgörü** — BDDK asgarisi (kural), asgari tuzağı (yargısız), ekstra ödeme etkisi.
4. **İkinci borç daveti** — "bir tane daha var mı?" (küçük lokma).
5. **Bu ay ne yapayım?** — iki ayrı blok:
   - **Blok A · Zorunlu:** asgariler + taksitler, son ödeme gününe göre.
   - **Blok B · Ekstra:** seçilen stratejiyle (çığ / kartopu) önceliklendirilmiş öneri.

## Üç temel kural

1. **Tavan ≠ gerçek** — tahminler TCMB azami oranıyla; dil hep "yaklaşık / tavan orana göre".
2. **Yargı yok, merdiven var** — skor/bölge yok; her uyarı bir sonraki adıma bağlanır.
3. **Wow opsiyonel alana takılmaz** — faiz/ekstra boş olsa da akış sürer.

## İki ayrı sistem (karıştırma)

| Ne | Bazı | Kaynak | Dil |
|---|---|---|---|
| **Asgari ödeme** | kart limiti | BDDK %20/%40 | kesin / kural |
| **Faiz tahmini** | dönem borcu | TCMB azami/tavan | yaklaşık / tavan orana göre |
| **Gerçek maliyet** | banka oranı + vergi/masraf | BSMV, KKDF… | değişebilir |

## Teknoloji

- **React 18 + TypeScript + Vite** — bağımlılık minimal.
- **PWA** — `manifest` + offline-first service worker, kurulabilir.
- **Local-first** — tüm veri `localStorage`'da; JSON export/import.
- **Saf çekirdek** — hesap mantığı `src/core/`'da, React'tan bağımsız ve test edilir.

## Mimari

```
src/
├── core/            # saf, test edilebilir çekirdek motor
│   ├── rateConfig.ts   # TCMB tavan oran tablosu + override (faiz: dönem borcu bazlı)
│   ├── minimum.ts      # BDDK asgari hesabı (kart limiti bazlı)
│   ├── interest.ts     # faiz tahmini + asgari-tuzağı simülasyonu
│   ├── payoff.ts       # Blok A/B sıralama (avalanche / snowball)
│   ├── dates.ts        # son ödeme gününe kalan gün
│   ├── format.ts       # tr-TR para parse/format
│   └── storage.ts      # local-first persist + export/import
├── data/            # banka listesi, örnek (sample) veri
├── analytics/       # event tracking (real_* vs sample_* ayrı)
├── components/      # paylaşılan UI (mikrocopy, rozetler)
├── screens/         # 5 ekran
└── state/           # Context + reducer store
```

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # çekirdek motor testleri (vitest)
npm run typecheck
npm run build      # üretim derlemesi -> dist/
npm run preview    # derlemeyi yerelde önizle
```

## Kapsam (0A)

**VAR:** kapısız giriş · tek borçla onboarding · gerçek/örnek event ayrımı · TCMB
tavan fallback · kullanıcı faiz override · BDDK asgari · ilk içgörü · zorunlu &
ekstra ödeme blokları · çığ/kartopu v1 · son ödeme uyarısı · local-first PWA · export/import.

**YOK (sonraki fazlar):** borç sağlık skoru · tam koçluk · Supabase sync · hane
daveti · MKK import · lead-gen · admin UI · gecikme faizi + BSMV/KKDF detaylı hesap ·
banka entegrasyonu.

## Önemli not (beta)

TCMB azami oranı değiştiğinde `src/core/rateConfig.ts` tablosu **elle** güncellenmeli
(admin UI 0B'de). Geçerli oran ve son kontrol tarihi UI'da küçük gösterilir.

---

Mühendislik kuralları ve tasarım kararları için: [`CLAUDE.md`](CLAUDE.md).
