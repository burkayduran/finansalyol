# Borç Takip 0A — İlk 5 Dakika Akışı (v0.2)

> Build-ready akış spesifikasyonu. Hedef: kullanıcı ilk 5 dakikada **"lan bu benim derdimi gördü"** desin. 0A'nın hipotezi: *borçtan-çıkış içgörüsü, kullanıcıyı biraz manuel girişe katlanacak kadar etkiliyor mu?*
> Tüm sayısal örnekler **illüstratiftir**, koda gömülmez. Para her zaman `numeric`, tr-TR format. Local-first, auth yok.

---

## 0. Üç ana kural (akışın her yerinde geçerli)

1. **Tavan ≠ gerçek.** Tahminler TCMB azami (tavan) oranıyla yapılır; dil her zaman "yaklaşık / tavan orana göre / olabilir". Kesin kazanç iddiası yok.
2. **Yargı yok, merdiven var.** Skor/bölge/damga yok. Her uyarı bir sonraki somut adıma bağlanır.
3. **Wow opsiyonel alana takılmaz.** APR ve ekstra tutar boşsa bile akış ve içgörü devam eder (fallback/illüstratif değerle).

---

## 1. Ekran 1 — Sert konumlandırma (kapısız giriş)

**Başlık:** Borcunu gör. Önceliğini bil. Faiz tuzağından çık.
**Alt metin:** Kredi kartı, KMH ve kredi borçlarını gir. Bu ay neyi önce ödemen gerektiğini 2 dakikada gör.

- **Ana CTA:** `İlk borcumu ekle`
- **İkincil CTA (vitrin):** `Örnek veriyle dene`

Kayıt yok, auth yok, sync yok. Kapı dikmiyoruz.

**Event:** `screen1_viewed`, `cta_real_clicked`, `cta_sample_clicked`

---

## 2. Ekran 2 — Tek borç girişi

Sadece **bir** borç istiyoruz. (Tümünü gir yok.)

| Alan | Zorunlu | Not |
|---|---|---|
| Borç türü | ✔ | Kredi kartı / KMH / Kredi |
| Banka | ✔ | Liste + "Diğer" |
| Borç tutarı (dönem borcu) | ✔ | tr-TR parse |
| Kart limiti | ✔ (kart ise) | Asgari oranını belirler (BDDK) |
| Son ödeme günü | ✔ | 1–31 |
| Aylık gelir | ✖ | Opsiyonel, önerilir |
| Bu ay ekstra ayırabileceğin tutar | ✖ | Opsiyonel |

**Faiz oranı SORULMAZ.** Mikrocopy:
> Faiz oranını bilmiyorsan sorun değil — TCMB tavan oranıyla tahmini hesaplarız. Bankandaki oran daha düşükse düzeltebilirsin.

**Event:** `real_debt_started`, `real_debt_completed` (kart/limit/son gün dolu), `field_dropoff:{field}` (terk edilen alan)

---

## 3. Ekran 3 — İlk içgörü (değer anı)

Kullanıcı borcu girer girmez **pat** diye gelir. Üç kart:

**Manşet:** Bu ay ödemen gereken asgari: **₺18.400** *(örnek)*
> Asgari = BDDK kuralı (limit ≤ 50.000 ₺ → %20, üzeri → %40). Bu kısım tahmin değil, kural.

**Kart 1 — Son ödeme riski**
"Son ödeme gününe **6 gün** var." → CTA: hatırlatma kur.

**Kart 2 — Asgari tuzağı (yargısız)**
"Sadece asgari ödersen kalan borca faiz işlemeye devam eder; bu gidişle borç **azalmaz / çok yavaş azalır**." (Simülasyon "azalmıyor/artıyor" derse bunu olduğu gibi, suçlamadan söyle.)

**Kart 3 — Ekstra ödeme etkisi**
- Ekstra **girilmişse:** "Bu ay ekstra ₺2.000 ayırırsan, tavan orana göre yaklaşık ₺X faiz yükünden kaçınabilirsin."
- Ekstra **boşsa (skip yolu):** "Örneğin ekstra ₺1.000 ayırabilirsen bunu en pahalı borca yönlendirmek daha hızlı rahatlatır. Kendi tutarını girerek planı netleştir."

**Dil:** "şu kadar kesin kurtulursun" ❌ → "tavan orana göre yaklaşık ₺X'ten kaçınabilirsin" ✔. Altta kalıcı mikrocopy:
> Tahmin TCMB 2026-06 azami oranlarıyla. Bankandaki gerçek oran daha düşükse taşıma maliyetin ve tasarrufun da daha düşük olur.

**Event:** `real_first_insight_viewed`, `reminder_set`, `extra_default_shown` (skip yolu tetiklendiyse)

---

## 4. Ekran 4 — İkinci borç daveti (küçük lokma)

Soru: **Başka borcun var mı?**
- `Evet, bir borç daha ekle` → Ekran 2'ye döner
- `Hayır, bu ayki planımı göster` → Ekran 5

"Tüm borçlarını gir" demiyoruz; "bir tane daha var mı?" diyoruz.

**Event:** `second_debt_added`, `proceed_to_plan`

---

## 5. Ekran 5 — "Bu ay ne yapayım?" (0A'nın kalbi)

İki **ayrı blok**. Karıştırma.

### Blok A — Önce gecikmeye düşme · Zorunlu ödemeler
Tüm kart asgarileri + kredi taksitleri + (varsa) kullanıcı tanımlı minimumlar. **Son ödeme gününe göre artan sırada.**

| Borç | Ödenecek minimum | Son gün | Neden |
|---|---|---|---|
| Garanti Bonus | ₺14.200 | 19 Haz | Asgari ödeme — gecikme riskini önler |
| İhtiyaç Kredisi | ₺8.750 | 25 Haz | Taksit ödemesi |
| Yapı Kredi Kart | ₺6.400 | 28 Haz | Asgari ödeme |

### Blok B — Ekstra paran varsa buraya koy · Ekstra ödeme önerisi
Zorunlulardan artan bütçe. **Sıralama tek anahtar = seçilen strateji** (varsayılan: avalanche).

| Öncelik | Borç | Neden (motordan üretilir) |
|---|---|---|
| 1 | Enpara KMH | En yüksek aylık oran (≈%4,25) — kalan borca en çok faiz burada |
| 2 | Akbank Kart | Sonraki en yüksek oranlı borç |

Altta sade özet (skor yok):
> Bu planla gecikme riskin azalır, KMH faiz yükün düşer, borç kapatma rotan başlar.

**Strateji seçimi:** Avalanche (en yüksek faiz) / Kartopu (en küçük bakiye) — tek toggle. Seçilen strateji Blok B'nin **tek** sıralama anahtarıdır.

**"Neden" metni kuralı:** Asla elle yazılmaz; motordan, gerçek/fallback orandan üretilir. Böylece gösterilen sıra ile gerekçe hiçbir zaman çelişmez.

**Event:** `real_plan_viewed`, `strategy_toggled:{avalanche|snowball}`, `payment_logged`

---

## 6. Plan motoru — sıralama mantığı (özet)

> Tam simülasyon `packages/core/payoff` içinde (bkz. CLAUDE.md §5.3). Burada yalnız ekran sıralaması.

```
1) Zorunlu (Blok A): kart asgarileri + kredi taksitleri + kullanıcı minimumları
   - amaç: gecikmeyi önle
   - sıralama: son ödeme günü (artan)
2) Ekstra (Blok B): kalan bütçe
   - sıralama: SEÇİLEN STRATEJİ (tek anahtar)
       avalanche -> aylık oran (azalan)   [KMH ve yüksek tier kartlar üste gelir]
       snowball  -> bakiye (artan)
   - KMH: regüle asgarisi yok -> her zaman EKSTRA hedefi olarak ele alınır, zorunlu değil
```

---

## 7. APR fallback config (0A: seed'li tablo, admin UI yok)

```jsonc
rate_source: {
  country: "TR", source_name: "TCMB", source_type: "maximum_cap",
  effective_date: "2026-06-01", last_checked_at: "2026-06-14", user_editable: true
}
// Aylık azami akdi faiz — TCMB (1 Ocak 2026'dan beri geçerli yapı)
credit_card_purchase: [
  { max_statement_debt: 30000,  monthly_rate: 0.0325 },
  { min_statement_debt: 30000, max_statement_debt: 180000, monthly_rate: 0.0375 },
  { min_statement_debt: 180000, monthly_rate: 0.0425 }
]
cash_advance_kmh: { monthly_rate: 0.0425 }
```

- **Faiz tieri = dönem borcu** bazlı (TCMB). **Asgari tieri = kart limiti** bazlı (BDDK %20/%40). Bunlar **iki ayrı** sistem, karıştırma.
- Kullanıcı kendi oranını girerse fallback'i ezer (`user_editable`).
- **Beta uyarısı:** TCMB oranı değişince bu tablo elle güncellenmeli (admin UI 0B'de). `last_checked_at` UI'da küçük gösterilir.

UI mikrocopy: *"TCMB 2026-06 azami oranlarıyla tahmini hesaplandı."*

---

## 8. Üçlü maliyet ayrımı (güven için, UI'da net)

| Ne | Kaynak | Dil |
|---|---|---|
| Asgari ödeme | BDDK kuralı (limit %20/%40) | Kesin / kural |
| Faiz tahmini | TCMB azami/tavan oran | "yaklaşık / tavan orana göre" |
| Gerçek maliyet | Banka oranı + vergi/masraf (BSMV, KKDF…) | "değişebilir; gerçek faturanla farklılaşır" |

Bu üçü karışırsa kullanıcı "uygulama ne hesaplıyor?" der ve güven gider. Ayrı tut.

---

## 9. Örnek veri vs gerçek veri (metrik temizliği)

`Örnek veriyle dene` **ikincil** CTA kalır; ana yol her zaman kendi borcunu gir.

```
sample_session_started        sample_first_insight_viewed
real_debt_started             real_debt_completed
real_first_insight_viewed     real_plan_viewed
```

**Funnel ve north-star yalnız `real_*` event'lerden okunur.** Sample ayrı analiz edilir (vitrin etkisi).

---

## 10. Metrikler ve okuma

**Ana funnel (gate adayları):**
- First Debt Completion — kendi verisini girdi mi?
- First Insight Viewed — değer anını gördü mü?
- **Plan Viewed** — Ekran 5'e ulaştı mı? *(asıl "değeri aldı" anı)*
- Second Debt Added — daha fazla veri vermeye razı mı?
- First Payment Logged — tekrar aksiyon yazdı mı?
- W4 Return — bir sonraki borç döngüsünde döndü mü?

**Destek sinyalleri (gate DEĞİL):**
- Time to First Insight (hedef < 2 dk)
- Manual Burden Signal (mini anket + `field_dropoff` davranışsal proxy)
- **D7 Return** — *nabız ölçer, ameliyat kararı vermez.*

**Cadence notu:** Ürün aylık döngülü. D7 ve First Payment Logged doğal olarak yavaş/düşük olabilir — beta penceresinde çoğu kullanıcının son ödeme günü içeri düşmez. Bunları **taban sinyali** oku; kararı Plan Viewed + Second Debt + W4 verir.

**7 günlük dönüş sebebi (hafif, opsiyonel):** "Son ödeme yaklaşıyor, ödeme girdin mi?" / "Planını kontrol et." Doğal D7 ile mühendislenmiş D7'yi event'te ayır.

**North-star (W4+):** Debt reduction rate — ürün insanları gerçekten borçtan çıkarıyor mu? 0A'nın ilk günleri için erken; W4/W8'de ölçülür.

---

## 11. 0A kapsam kilidi

**VAR:** kapısız giriş · tek borçla onboarding · gerçek/örnek veri event ayrımı · TCMB tavan oran fallback · kullanıcı faiz override · BDDK asgari hesabı · ilk içgörü ekranı · zorunlu ödeme bloğu · ekstra ödeme önerisi bloğu · çığ/kartopu v1 · son ödeme uyarısı · local-first PWA · export/import

**YOK (sonraki fazlar):** borç sağlık skoru · tam koçluk ekranı · Supabase sync · hane daveti · MKK import · lead-gen · admin UI · gecikme faizi + BSMV/KKDF detaylı hesap · banka entegrasyonu

---

## 12. Açık uçlar (0B'ye itildi)

- Gecikme faizi / vergi-masraf ile "gerçek maliyet" hassas hesabı.
- Tam "Bu ay ne yapayım?" koçluk hali (çok aylık plan, ivme takibi).
- Borç sağlık / risk bölgesi (yalnız "bölge + çıkış adımı" formatında).
- Yapılandırma karşılaştırıcı (referans orana bağlı tavan; sabit "60 ay" değil) — Faz 1.
