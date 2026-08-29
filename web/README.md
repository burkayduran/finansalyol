# Public Web Sayfaları (legal + hesap silme)

Statik HTML; herhangi bir statik host'a (Netlify / Vercel / GitHub Pages / Cloudflare Pages)
deploy edilebilir. App Store / Google Play'e verilecek URL'ler production'da **HTTP 200** dönmeli.

## Sayfalar → hedef URL
- `web/legal/gizlilik.html`  → `https://<domain>/legal/gizlilik`
- `web/legal/kvkk.html`      → `https://<domain>/legal/kvkk`
- `web/legal/kosullar.html`  → `https://<domain>/legal/kosullar`
- `web/hesap-silme.html`     → `https://<domain>/hesap-silme`

(Host'ta uzantısız yönlendirme yapılandır; ör. Netlify `_redirects` veya rewrites.)

## Senkron
Legal HTML metinleri uygulama içi `app/legal/*.tsx` ile **aynı** tutulmalıdır. Nihai hukuki
metinler hukuk onayından sonra hem uygulamada hem burada güncellenir; `src/lib/legal.ts`
`LEGAL_VERSIONS` sürümleri de artırılır (esaslı Koşul değişikliğinde yeniden kabul tetiklenir).

## hesap-silme.html yapılandırması
`__FUNCTIONS_BASE__` yer tutucusunu Supabase Functions taban URL'i ile değiştir:
`https://<project-ref>.functions.supabase.co`. Sayfa `request-account-deletion` fonksiyonuna
POST atar; fonksiyon doğrulama e-postası gönderir (yalnız e-posta ile SİLMEZ).

## brand.ts.urls
`src/config/brand.ts` içindeki `urls` alanlarını bu domaine göre güncelle.
