-- Düzeltme Spec'i 2: taksitli borç toplamı · varlık türleri/fiyat · FX · gelir-gider

-- §1 debts: toplam tutar (kalan borç bundan türetilir)
alter table public.debts add column if not exists total_amount numeric(14,2);

-- §2 assets: yeni türler + maliyet/fiyat alanları
alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind in ('cash','deposit','fund','stock','commodity','crypto','other'));
alter table public.assets
  add column if not exists symbol text,             -- fon kodu / hisse ticker / coin sembolü
  add column if not exists commodity_type text,     -- gold|silver|platinum|palladium
  add column if not exists quantity   numeric(18,6),-- adet / pay / gram
  add column if not exists buy_price  numeric(18,6),-- alış birim fiyatı (currency cinsinden)
  add column if not exists last_price numeric(18,6),-- güncel birim fiyat (manuel veya oto)
  add column if not exists last_price_at timestamptz,
  add column if not exists price_source text;       -- 'manual'|'tcmb'|'btcturk'|'tefas'...

-- §3 fx_rates: TCMB kurları (cron yazar, herkes okur)
create table if not exists public.fx_rates (
  currency         text primary key,     -- 'USD','EUR'...
  forex_buying     numeric,
  forex_selling    numeric,
  banknote_buying  numeric,
  banknote_selling numeric,
  rate_date        date not null,
  updated_at       timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
drop policy if exists "fx read" on public.fx_rates;
create policy "fx read" on public.fx_rates for select using (auth.role() = 'authenticated');
-- yazma yalnız service role (cron) — RLS politikası yok, service role RLS bypass eder.

-- §5 cash_flows: gelir + düzenli gider tek tabloda
create table if not exists public.cash_flows (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  person_id    uuid references public.persons(id) on delete set null,
  direction    text not null check (direction in ('income','expense')),
  category     text not null,  -- income: salary|rent|interest|other · expense: rent|bill|subscription|other
  label        text,
  amount       numeric(14,2) not null check (amount >= 0),
  currency     text not null default 'TRY',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cashflows_household on public.cash_flows (household_id);
alter table public.cash_flows enable row level security;
drop policy if exists "cashflows all" on public.cash_flows;
create policy "cashflows all" on public.cash_flows for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
