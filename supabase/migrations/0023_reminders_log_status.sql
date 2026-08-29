-- v2.4 — Hatırlatma gönderim durum modeli. claim (unique index) → sending → sent/failed.
-- Böylece "gönderilmeden sent sayma" olmaz; kalıcı hatada retry mümkün.
alter table public.reminders_log
  add column if not exists status text not null default 'claimed'
    check (status in ('claimed', 'sending', 'sent', 'failed')),
  add column if not exists attempt_count int not null default 0,
  add column if not exists last_error text,
  add column if not exists last_attempt_at timestamptz;
