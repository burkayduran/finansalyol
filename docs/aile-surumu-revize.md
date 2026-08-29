# Borç Takip — Aile Sürümü (Revize Yön)

## Ne yapıyoruz
Bir ailenin (eş, anne, baba… kim varsa) tüm **borçlarını, ödemelerini ve birikimlerini tek ekranda** gösteren bulut tabanlı bir uygulama. Ödeme günü yaklaşınca **push + e-posta** ile hatırlatır. "Sadece asgari ödersen ne olur / biraz fazlası ne kazandırır" gibi borç-azaltma içgörüleri **yan özellik** — vitrin değil.

Konumlandırma (slogan değil, sıcak): *Ailenizin parası, tek ekranda.*

## Çekirdek ekran (kalp)
**Aile panosu:** toplam borç (kişi kırılımlı, dokununca açılır), toplam varlık, net durum ve **yaklaşan ödemeler**. Onboarding "ilk hesabını ekle" + "aileni davet et" üzerine kurulu. Borç-azaltma/asgari-tuzağı her borcun içinde isteğe bağlı bir sekme.

## Hatırlatma
- **Push (birincil):** borç başına, ayarlanan gün önce + son gün.
- **E-posta (ikincil):** haftalık "bu haftanın ödemeleri" özeti + push kapalıysa yedek; aile ortak özet maili de buradan.
- Varsayılan ikisi de açık; kullanıcı kanalları yönetir.

## Mimari
- **Mobil-first: Expo (React Native)** — native push için.
- **Bulut: Supabase** (Auth + Postgres + RLS).
- **Hatırlatma motoru:** backend zamanlayıcı (günlük cron) → yaklaşan vadeleri bulur → Expo push + e-posta gönderir.
- **Hane modeli:** *üye* (giriş yapan aile ferdi) ile *kişi* (borç bağlanan ama uygulamayı kullanmak zorunda olmayan anne/baba) ayrımı; biri ikisi birden de olabilir.

## Gelir
- **Aile paketi — ~100₺/ay:** sınırsız kişi, push + e-posta, borç-azaltma içgörüleri, paylaşım.
- **Ücretsiz/deneme:** 1 kişi + temel hatırlatma (üst pakete iştah açar).
- **Borç azaltma koçluğu (add-on):** ayrı ücretli hizmet.
  - ⚠️ "Koçluk/eğitim" diye konumla, "yatırım tavsiyesi" değil (SPK lisanslı alan). Komisyonlu ürün önerme yapısı mevzuata tabi — avukatla netleştir.

## Kullanıcıya görünen dil (sıcak ve az)
İç prensipler (yargısız ton, tavan≠gerçek, az soru) **bizde kalır, ekrana yazılmaz.** Örnekler:

- **Hero:** "Ailenizin parası, tek ekranda. Borçlar, ödemeler, birikimler — hep birlikte görün; biz de yaklaşınca hatırlatalım."
- **Push:** "Yarın VakıfBank kartının son ödeme günü — asgari ₺8.000."
- **Haftalık mail:** "Bu hafta 2 ödemen var: VakıfBank (₺8.000, Salı), Akbank (₺6.400, Cuma)."
- **Asgari içgörüsü:** "Sadece asgarisini ödersen kalan borca faiz işler. Bu ay biraz fazlasını ayırabilirsen şunu kazanırsın: …"
- **Tahmin notu:** küçük "≈ tahmini" → dokun → "TCMB üst sınır oranıyla hesapladık; kendi oranını girersen daha doğru olur."

## Fazlar (yalın)
- **F1 — Aile panosu + hatırlatma (bulut):** Expo app, Supabase auth + hane, hesap/borç/ödeme/varlık girişi, aile daveti, push + e-posta hatırlatma, asgari-tuzağı içgörüsünün basit hali.
- **F2 — Derinlik + para:** çığ/kartopu, koçluk add-on, abonelik, raporlar, (MKK varlık import yan modül).
- **F3 — Banka entegrasyonu (lisanslı partner):** manuel yükü düşürür — asıl moat.
- Global: sonra.

## Açık uçlar
- Abonelik altyapısı: App Store/Play faturalama (komisyon) vs. iyzico/Stripe.
- Koçluğu kim verecek (içeride mi, partner mı) + mevzuat.
- Free/paid sınırının tam çizgisi.
