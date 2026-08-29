-- v2.4 — Sunucu tarafı yapılandırma. İstemcinin değiştiremeyeceği rollout bayrakları.
-- server_entitlement_enforcement_enabled: premium server-side zorlaması (varsayılan KAPALI).
-- Yalnız purchase verification canlıya alınınca (service-role ile) 'true' yapılır.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Okuma tüm oturumlu kullanıcılara açık; YAZMA politikası YOK (yalnız service-role).
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select using (auth.role() = 'authenticated');

insert into public.app_config (key, value)
values ('server_entitlement_enforcement_enabled', 'false')
on conflict (key) do nothing;

-- Zorlama açık mı? (app_config'ten okur; kayıt yoksa KAPALI kabul → güvenli varsayılan)
create or replace function public.enforcement_on() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value = 'true' from public.app_config where key = 'server_entitlement_enforcement_enabled'),
    false);
$$;
