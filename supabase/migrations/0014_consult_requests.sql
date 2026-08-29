-- v1.9 — "Borç Azaltma Planı" danışmanlık talep formu. Birebir hizmet; native IAP DIŞI.
-- Kullanıcı talebini bırakır; ekip manuel iletişim + ödeme linki/havale ile ilerler.
create table if not exists public.consult_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  preferred_time text,
  note text,
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table public.consult_requests enable row level security;

drop policy if exists consult_requests_insert on public.consult_requests;
create policy consult_requests_insert on public.consult_requests
  for insert with check (user_id = auth.uid());

drop policy if exists consult_requests_self_read on public.consult_requests;
create policy consult_requests_self_read on public.consult_requests
  for select using (user_id = auth.uid());
