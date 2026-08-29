-- v2.4 — Gerçek hesap silme durum modeli (append-only). delete-account Edge Function
-- (service-role) bu satırları işler; istemci yalnız kendi talebini açar/iptal eder (pending iken).

-- Eski 'done' → 'completed' taşı, sonra genişletilmiş durum kümesini uygula.
update public.account_deletion_requests set status = 'completed' where status = 'done';

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));

alter table public.account_deletion_requests
  add column if not exists requested_at          timestamptz not null default now(),
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at          timestamptz,
  add column if not exists cancelled_at          timestamptz,
  add column if not exists failure_reason        text,
  add column if not exists retry_count           int not null default 0,
  add column if not exists requested_by          uuid,
  add column if not exists replacement_owner_id  uuid references public.persons (id) on delete set null,
  add column if not exists last_attempt_at       timestamptz;

-- Aynı kullanıcı için tek aktif (pending/processing) talep.
create unique index if not exists adr_one_active
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing');

-- RLS'i sıkılaştır: geniş "for all" yerine granüler (yazma yalnız kendi + iptal pending iken).
drop policy if exists "adr self" on public.account_deletion_requests;

create policy adr_self_read on public.account_deletion_requests
  for select using (user_id = auth.uid());

create policy adr_self_insert on public.account_deletion_requests
  for insert with check (user_id = auth.uid() and status = 'pending');

-- Kullanıcı yalnızca pending talebini 'cancelled' yapabilir; başka durum değişimi service-role işidir.
create policy adr_self_cancel on public.account_deletion_requests
  for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'cancelled');
