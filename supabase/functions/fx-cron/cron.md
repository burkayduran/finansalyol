# fx-cron & price-cron — kurulum

## Deploy

```bash
supabase functions deploy fx-cron --no-verify-jwt
supabase functions deploy price-cron --no-verify-jwt
```

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Edge ortamında otomatik gelir; servis
service-role ile `fx_rates` / `assets`'e yazar (RLS bypass).

## Zamanlama (pg_cron + pg_net, SQL editöründe)

```sql
-- FX: her iş günü ~16:00 TR (TCMB ~15:30 yayınlar). 13:00 UTC.
select cron.schedule(
  'daily-fx', '0 13 * * 1-5',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/fx-cron',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
     ); $$
);

-- Oto-fiyat (kripto): her gün ~16:30 TR.
select cron.schedule(
  'daily-prices', '30 13 * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/price-cron',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
     ); $$
);
```

## Kaynak gerçeği (dürüst)

| Varlık | Kaynak | Durum |
|---|---|---|
| Döviz (FX) | TCMB `today.xml` | Açık, güvenilir — **oto (şimdi)** |
| Kripto | BtcTurk public (TRY) | Güvenilir — **oto (şimdi)** |
| Fon / Hisse / Altın | TEFAS / Yahoo / XAU türetme | Kırılgan — **manuel-önce**, best-effort sonra |

Manuel-önce ilke: her fiyatlı varlıkta kullanıcı `buy_price`/`last_price` girebilir;
oto-fiyat yalnızca `last_price`'ı günceller. Kaynak bozulsa bile K/Z manuel veriyle çalışır.
