-- Borç Takip — Aile Sürümü · Supabase şeması (F1)
-- Hane modeli: ÜYE (giriş yapan aile ferdi) ile KİŞİ (borç bağlanan ama
-- uygulamayı kullanmak zorunda olmayan anne/baba) ayrımı. Biri ikisi de olabilir.
--
-- Tüm tablolar RLS ile korunur: bir üye yalnızca ÜYESİ OLDUĞU hane(ler)in
-- verisini görebilir/yazabilir.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — auth.users 1:1 (üye kimliği)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

-- Yeni auth.users -> profiles satırı otomatik oluştur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- households — hane
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- household_members — üye ↔ hane
create table if not exists public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  created_at    timestamptz not null default now(),
  unique (household_id, member_id)
);
create index if not exists idx_hm_member on public.household_members (member_id);
create index if not exists idx_hm_household on public.household_members (household_id);

-- ---------------------------------------------------------------------------
-- Yardımcı: aktif kullanıcı bu haneye üye mi? (RLS'te sonsuz döngüyü önlemek
-- için security definer.)
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(hh uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and member_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(hh uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hh and member_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- household_invites — aile daveti
-- ---------------------------------------------------------------------------
create table if not exists public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  email         text not null,
  code          text not null unique default encode(gen_random_bytes(6), 'hex'),
  invited_by    uuid not null references public.profiles (id),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days')
);

-- ---------------------------------------------------------------------------
-- persons — KİŞİ (borç/varlık bağlanan; üye olmak zorunda değil)
-- ---------------------------------------------------------------------------
create table if not exists public.persons (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  display_name      text not null,
  linked_member_id  uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_persons_household on public.persons (household_id);

-- ---------------------------------------------------------------------------
-- debts — borçlar (kredi kartı / KMH / kredi)
-- ---------------------------------------------------------------------------
create table if not exists public.debts (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  person_id          uuid references public.persons (id) on delete set null,
  kind               text not null check (kind in ('credit_card', 'kmh', 'kmh_installment', 'loan')),
  bank               text not null,
  label              text,
  balance            numeric(14, 2) not null default 0,  -- loan/kmh_installment: türetilir
  total_amount       numeric(14, 2),      -- toplam kredi/avans tutarı (taksitli)
  card_limit         numeric(14, 2),
  installment        numeric(14, 2),
  term_count             int,             -- toplam taksit sayısı (loan / kmh_installment)
  first_installment_date date,            -- ilk taksit tarihi (due_day buradan türer)
  due_day            int not null check (due_day between 1 and 31),
  user_monthly_rate  numeric(6, 5),       -- kullanıcı oranı; fallback'i ezer
  user_minimum       numeric(14, 2),
  currency           text not null default 'TRY',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_debts_household on public.debts (household_id);

-- ---------------------------------------------------------------------------
-- assets — varlıklar (birikim / mevduat / nakit)
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  person_id     uuid references public.persons (id) on delete set null,
  label         text not null,
  kind          text not null default 'cash'
                check (kind in ('cash', 'deposit', 'fund', 'stock', 'commodity', 'crypto', 'other')),
  balance       numeric(14, 2) not null default 0,  -- mevduatta = anapara
  annual_rate   numeric(6, 3),   -- yıllık faiz %, mevduat
  term_days     int,             -- vade (gün), mevduat
  stopaj        numeric(5, 2),   -- stopaj %, mevduat
  start_date    date,            -- başlangıç tarihi, mevduat
  symbol         text,            -- fon kodu / hisse ticker / coin sembolü
  commodity_type text,            -- gold|silver|platinum|palladium
  quantity       numeric(18, 6),  -- adet / pay / gram
  buy_price      numeric(18, 6),  -- alış birim fiyatı (currency cinsinden)
  last_price     numeric(18, 6),  -- güncel birim fiyat (manuel veya oto)
  last_price_at  timestamptz,
  price_source   text,            -- 'manual'|'tcmb'|'btcturk'|'tefas'...
  currency      text not null default 'TRY',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_assets_household on public.assets (household_id);

-- ---------------------------------------------------------------------------
-- payments — ödemeler (borca karşı kaydedilen ödeme)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  debt_id       uuid not null references public.debts (id) on delete cascade,
  amount        numeric(14, 2) not null check (amount > 0),
  paid_at       date not null default current_date,
  note          text,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index if not exists idx_payments_debt on public.payments (debt_id);

-- ---------------------------------------------------------------------------
-- push_tokens — Expo push token'ları (cihaz başına)
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles (id) on delete cascade,
  expo_token  text not null unique,
  platform    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notification_prefs — kanal tercihleri (üye düzeyi). Varsayılan ikisi de açık.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_prefs (
  member_id      uuid primary key references public.profiles (id) on delete cascade,
  push_enabled   boolean not null default true,
  email_enabled  boolean not null default true,
  days_before    int not null default 1 check (days_before between 0 and 7),
  weekly_digest  boolean not null default true,
  digest_weekday int not null default 1 check (digest_weekday between 0 and 6) -- 1 = Pazartesi
);

-- ---------------------------------------------------------------------------
-- reminders_log — gönderim idempotency (cron'un aynı bildirimi tekrar atmaması)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders_log (
  id          uuid primary key default gen_random_uuid(),
  debt_id     uuid references public.debts (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  channel     text not null check (channel in ('push', 'email')),
  kind        text not null check (kind in ('advance', 'due_day', 'weekly')),
  due_date    date,
  sent_at     timestamptz not null default now(),
  unique (debt_id, member_id, channel, kind, due_date)
);

-- updated_at otomatik güncelleme
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_debts on public.debts;
create trigger touch_debts before update on public.debts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_assets on public.assets;
create trigger touch_assets before update on public.assets
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.profiles            enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.household_invites   enable row level security;
alter table public.persons             enable row level security;
alter table public.debts               enable row level security;
alter table public.assets              enable row level security;
alter table public.payments            enable row level security;
alter table public.push_tokens         enable row level security;
alter table public.notification_prefs  enable row level security;
alter table public.reminders_log       enable row level security;

-- profiles: kendi profilini gör/güncelle
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid());

-- households: üyesi olduğun haneleri gör; herkes hane kurabilir
create policy "households read"   on public.households for select using (public.is_household_member(id));
create policy "households insert" on public.households for insert with check (created_by = auth.uid());
create policy "households update" on public.households for update using (public.is_household_owner(id));
create policy "households delete" on public.households for delete using (public.is_household_owner(id));

-- household_members: kendi üyeliğini ve aynı hanedeki üyelikleri gör
create policy "hm read"   on public.household_members for select using (public.is_household_member(household_id));
create policy "hm insert" on public.household_members for insert
  with check (member_id = auth.uid() or public.is_household_owner(household_id));
create policy "hm delete" on public.household_members for delete
  using (member_id = auth.uid() or public.is_household_owner(household_id));

-- invites: hane sahibi yönetir
create policy "invites read"   on public.household_invites for select using (public.is_household_member(household_id));
create policy "invites insert" on public.household_invites for insert with check (public.is_household_owner(household_id));
create policy "invites update" on public.household_invites for update using (public.is_household_owner(household_id));

-- Hane-kapsamlı tablolar için ortak desen: üyeysen tam erişim.
create policy "persons all"  on public.persons  for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "debts all"    on public.debts    for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "assets all"   on public.assets   for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "payments all" on public.payments for all using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- push_tokens & prefs: yalnızca kendin
create policy "tokens self" on public.push_tokens for all using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "prefs self"  on public.notification_prefs for all using (member_id = auth.uid()) with check (member_id = auth.uid());

-- reminders_log: kendi gönderim kayıtlarını gör (yazma backend/service role'da)
create policy "reminders read" on public.reminders_log for select using (member_id = auth.uid());

-- ===========================================================================
-- cash_flows — gelir + düzenli gider (Düzeltme Spec'i 2 §5)
-- ===========================================================================
create table if not exists public.cash_flows (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  person_id    uuid references public.persons (id) on delete set null,
  direction    text not null check (direction in ('income', 'expense')),
  category     text not null,
  label        text,
  amount       numeric(14, 2) not null check (amount >= 0),
  currency     text not null default 'TRY',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cashflows_household on public.cash_flows (household_id);
alter table public.cash_flows enable row level security;
create policy "cashflows all" on public.cash_flows for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ===========================================================================
-- fx_rates — TCMB döviz kurları (cron yazar, kimliği doğrulanan herkes okur)
-- ===========================================================================
create table if not exists public.fx_rates (
  currency         text primary key,
  forex_buying     numeric,
  forex_selling    numeric,
  banknote_buying  numeric,
  banknote_selling numeric,
  rate_date        date not null,
  updated_at       timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy "fx read" on public.fx_rates for select using (auth.role() = 'authenticated');
-- yazma yalnız service role (cron); RLS bypass eder.
