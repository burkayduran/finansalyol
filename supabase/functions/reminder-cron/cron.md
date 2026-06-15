# reminder-cron — kurulum

Günlük çalışan hatırlatma motoru. Yaklaşan vadeleri bulur, Expo push + haftalık
e-posta gönderir.

## 1. Secret'lar

```bash
supabase secrets set RESEND_API_KEY=...        # e-posta sağlayıcı (Resend)
supabase secrets set RESEND_FROM="Borç Takip <hatirlatma@seninalanadın.app>"
# SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Edge ortamında otomatik gelir.
```

## 2. Deploy

```bash
supabase functions deploy reminder-cron --no-verify-jwt
```

> `--no-verify-jwt`: fonksiyon cron tarafından (kullanıcı JWT'si olmadan) tetiklenir.
> Servis, service-role key ile RLS'i bypass ederek tüm haneleri tarar.

## 3. Zamanlama (günde 1 kez, sabah 09:00 TR)

`pg_cron` + `pg_net` ile (Supabase SQL editöründe):

```sql
select cron.schedule(
  'daily-reminders',
  '0 6 * * *',  -- 06:00 UTC ≈ 09:00 Europe/Istanbul
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/reminder-cron',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);
```

## 4. Yerelde test

```bash
supabase functions serve reminder-cron --env-file ./supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/reminder-cron
```
