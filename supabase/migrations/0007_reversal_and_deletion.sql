-- MVP v1.3 — ödeme geri alma (reversible) + hesap silme talebi.

-- payments: geri alma (fiziksel silme yerine işaretle)
alter table public.payments
  add column if not exists is_reversed boolean not null default false,
  add column if not exists reversed_at timestamptz;

-- Hesap silme talebi (gerçek deletion flow sonraki faz; talep kaydı tutulur)
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  reason       text,
  created_at   timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
drop policy if exists "adr self" on public.account_deletion_requests;
create policy "adr self" on public.account_deletion_requests for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
