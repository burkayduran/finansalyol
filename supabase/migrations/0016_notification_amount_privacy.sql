-- v2.3 — Mahremiyet: kilit ekranı bildiriminde borç tutarını gizleme tercihi.
-- Varsayılan GİZLİ (true): tutar başkalarının görebileceği kilit ekranında yazılmaz.
alter table public.notification_prefs
  add column if not exists hide_amount_in_notifications boolean not null default true;
