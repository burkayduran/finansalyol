-- v2.3 — Hukuki kabul kayıtları (immutable). Kullanım Koşulları KABULÜ + KVKK/Gizlilik
-- BİLGİLENDİRME kaydı ayrı document_type'larla tutulur. IP/cihaz parmak izi TUTULMAZ.
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,     -- 'terms' | 'kvkk_notice' | 'privacy' | 'explicit_consent'
  document_version text not null,
  accepted_at timestamptz not null default now(),
  locale text,
  created_at timestamptz not null default now()
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, document_type, document_version);

alter table public.legal_acceptances enable row level security;

-- Kullanıcı yalnız kendi kaydını ekler/okur; UPDATE/DELETE politikası YOK (immutable).
drop policy if exists legal_acceptances_self_insert on public.legal_acceptances;
create policy legal_acceptances_self_insert on public.legal_acceptances
  for insert with check (user_id = auth.uid());

drop policy if exists legal_acceptances_self_read on public.legal_acceptances;
create policy legal_acceptances_self_read on public.legal_acceptances
  for select using (user_id = auth.uid());
