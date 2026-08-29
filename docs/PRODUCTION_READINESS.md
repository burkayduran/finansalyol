# Production Readiness Raporu (v2.3 hardening)

## Aşama 1 — Mevcut durum
- **Çalışan:** auth (kayıt/giriş/şifre sıfırlama), hane+kişi+davet, borç/ödeme/varlık,
  occurrence motoru + atomik ödeme RPC (0009–0011), pano/aile/takvim, **push** hatırlatma,
  freemium UI gate + paywall paket seçimi, danışmanlık talep formu, TCMB fx/BtcTurk price cron.
- **Bu sprintte eklenen/güçlendirilen (kod, doğrulandı):** ESLint (0 hata), app.json hijyeni,
  bildirim tutar-mahremiyeti (varsayılan gizli), `legal_acceptances` + kayıt ekranı Koşullar onayı,
  analytics reset (logout), davet e-posta eşleşmesi (server-side), 9 yeni finansal/FX/tarih testi.
- **Stub/eksik (dış hesap gerektirir, taklit edilmedi):** gerçek IAP satın alma, server-side
  premium zorlaması, gerçek e-posta gönderimi, hesap-silme worker'ı, public web legal sayfaları.

## Güvenlik / veri riskleri (durum)
- Premium gate hâlâ ağırlıkla **client-side** → doğrudan REST/RPC bypass mümkün. Server zorlaması
  0015 template'lerinde hazır ama **IAP+receipt-verify canlı olmadan açılamaz** (aksi halde mevcut
  kullanıcılar kilitlenir). → Bilinen blocker.
- Davet: artık server-side e-posta eşleşmesi + tek kullanım + süre + uid guard (0018). Kod hâlâ
  düz metin saklıyor; hash'leme follow-up (düşük risk, tek kullanımlık + eşleşme mevcut).
- reminder-cron endpoint imza/secret doğrulaması: **eksik** → cron URL'i imzalı/secret'lı çağrılmalı (follow-up).
- Bildirimde tutar: varsayılan gizli (eklendi).

## Aşama bazında sonuç
- **A2 (config/deps):** app.json düzeltildi, ESLint eklendi, `npm ci/typecheck/lint/test` yeşil.
  Dep major upgrade + expo-doctor bu ortamda native doğrulanamadığı için MANUAL_ACTIONS'a bırakıldı.
- **A3 (IAP):** kod iskelesi + plan; gerçek satın alma dev-build + store hesabı işi (MANUAL_ACTIONS §3).
- **A4 (server premium):** 0015 salt-okur helper'lar + template; zorlama IAP sonrası.
- **A5 (hesap silme):** talep + status ihtiyacı belirlendi; gerçek worker + owner-transfer follow-up.
- **A6 (bildirim):** push idempotent (claim-then-send); e-posta gönderimi yok (README düzeltildi);
  mahremiyet tercihi eklendi. Retry/receipt/token temizliği follow-up.
- **A7 (davet):** e-posta eşleşme + uid guard eklendi (0018).
- **A8 (hukuki):** `legal_acceptances` + Koşullar onay kutusu (önceden işaretsiz) + KVKK/Gizlilik
  "okudum". Public web sayfaları + versiyonlu yeniden-kabul follow-up.
- **A9 (veri işleyen):** `docs/DATA_PROCESSOR_INVENTORY.md`.
- **A10 (analitik):** PII göndermiyor (doğrulandı), logout reset eklendi; `docs/STORE_PRIVACY_DECLARATIONS.md`.
- **A11 (finansal doğruluk):** 60 mevcut test korundu + 9 yeni (ay sonu/artık yıl/FX/occurrence).
- **A12 (kalite):** ESLint + testler CI'ya hazır; tam e2e (auth/IAP sandbox/RLS/erişilebilirlik) follow-up.

## Production'a hazır mı?
**HAYIR — henüz değil.** Çekirdek borç-takip deneyimi (free) sağlam ve yayına yakın; ancak
para kazanma (IAP), server-side premium güvenliği, gerçek e-posta, hesap-silme işleme ve public
legal sayfaları **dış hesap/secret/native build** gerektirir ve bu ortamda tamamlanıp doğrulanamaz.
Bunlar `MANUAL_ACTIONS.md`'de net adımlarla listelendi. O adımlar tamamlanınca yeniden değerlendirilmeli.
