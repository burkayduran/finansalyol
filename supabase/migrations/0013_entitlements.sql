-- v1.9 — Abonelik entitlement'ı (RevenueCat YOK). Native IAP makbuzu backend'te
-- doğrulanıp bu tabloya yazılır (service-role). İstemci yalnız kendi satırını OKUR.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  subscription_status text not null default 'inactive',
  person_limit int not null default 1,
  premium_until timestamptz,
  platform text,
  product_id text,
  last_receipt_check_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.entitlements enable row level security;

drop policy if exists entitlements_self_read on public.entitlements;
create policy entitlements_self_read on public.entitlements
  for select using (user_id = auth.uid());
-- Yazma politikası YOK: yalnız service-role (makbuz doğrulama backend'i) yazar.
