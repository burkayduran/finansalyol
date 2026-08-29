-- v2.4 — Girişsiz (public) hesap silme talebi (Google Play gerekliliği).
-- Yalnız e-posta ile SİLMEZ; doğrulama bağlantısı gönderilir. Token hash'lenmiş saklanır.
-- İstemci erişimi YOK (RLS açık, politika yok → yalnız service-role Edge Function erişir).
create table if not exists public.public_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email_norm text not null,
  token_hash text not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'processed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz
);
create index if not exists pdr_email_created on public.public_deletion_requests (email_norm, created_at);
create index if not exists pdr_token on public.public_deletion_requests (token_hash);

alter table public.public_deletion_requests enable row level security;
-- Politika yok: anon/authenticated erişemez; service-role (Edge Function) bypass ile erişir.

-- E-postadan auth kullanıcı id'si bul (yalnız server/service-role bağlamında kullanılır).
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
revoke all on function public.find_user_id_by_email(text) from anon;
revoke all on function public.find_user_id_by_email(text) from authenticated;
