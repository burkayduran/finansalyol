-- v1.8 — Faiz oranlarını data olarak yönet. rate_caps tablosu; veri yoksa
-- istemci kod-içi fallback (rateConfig.ts) kullanır. Deploy'suz oran güncelleme.

create table if not exists public.rate_caps (
  id uuid primary key default gen_random_uuid(),
  debt_kind text not null,
  min_amount numeric,
  max_amount numeric,
  monthly_rate numeric not null,
  effective_date date not null,
  source_name text,
  source_url text,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);

-- Referans veri: hane-kapsamlı DEĞİL. RLS açık; tüm oturumlu kullanıcılar okur,
-- yazma yok (service-role / SQL ile güncellenir).
alter table public.rate_caps enable row level security;

drop policy if exists rate_caps_read on public.rate_caps;
create policy rate_caps_read on public.rate_caps
  for select using (auth.role() = 'authenticated');

-- Güncel TCMB tavan tablosu (rateConfig.ts ile birebir seed). Oran DEĞİŞİRSE
-- yeni satır eklenir (effective_date güncel); istemci en güncel effective_date'i alır.
insert into public.rate_caps (debt_kind, min_amount, max_amount, monthly_rate, effective_date, source_name)
values
  ('credit_card', null,   30000,  0.0325, '2026-06-01', 'TCMB'),
  ('credit_card', 30000,  180000, 0.0375, '2026-06-01', 'TCMB'),
  ('credit_card', 180000, null,   0.0425, '2026-06-01', 'TCMB'),
  ('kmh',            null, null,   0.0425, '2026-06-01', 'TCMB'),
  ('installment_kmh', null, null,  0.0425, '2026-06-01', 'TCMB'),
  ('loan',           null, null,   0.0325, '2026-06-01', 'TCMB');
