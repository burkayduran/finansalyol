-- MVP Revizyon v1.1 — sahiplik modeli · payment occurrence · borç modeli genişletme.
-- Mevcut veriyi SİLMEZ; eski kayıtlara güvenli varsayılan atar.

-- ---------------------------------------------------------------------------
-- 1) Sahiplik modeli: owner_type + person_id (debts'te person_id zaten var)
-- ---------------------------------------------------------------------------
alter table public.debts
  add column if not exists owner_type text not null default 'person'
    check (owner_type in ('person', 'household'));
alter table public.assets
  add column if not exists owner_type text not null default 'person'
    check (owner_type in ('person', 'household'));
alter table public.cash_flows
  add column if not exists owner_type text not null default 'person'
    check (owner_type in ('person', 'household'));
alter table public.payments
  add column if not exists owner_type text not null default 'household'
    check (owner_type in ('person', 'household')),
  add column if not exists person_id uuid references public.persons (id) on delete set null,
  add column if not exists occurrence_id uuid;

-- Eski kayıtlar: person_id varsa person, yoksa household.
update public.debts      set owner_type = case when person_id is not null then 'person' else 'household' end;
update public.assets     set owner_type = case when person_id is not null then 'person' else 'household' end;
update public.cash_flows set owner_type = case when person_id is not null then 'person' else 'household' end;

-- Varlık türleri: Altın (gold) ve Döviz (fx) eklendi (commodity/crypto geriye uyum için kalır).
alter table public.assets drop constraint if exists assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind in ('cash', 'deposit', 'fund', 'stock', 'commodity', 'gold', 'fx', 'crypto', 'other'));

-- ---------------------------------------------------------------------------
-- 2) Borç modeli genişletme + kind rename (kmh_installment -> installment_kmh)
-- ---------------------------------------------------------------------------
alter table public.debts drop constraint if exists debts_kind_check;
update public.debts set kind = 'installment_kmh' where kind = 'kmh_installment';
alter table public.debts add constraint debts_kind_check
  check (kind in ('credit_card', 'kmh', 'installment_kmh', 'loan'));

alter table public.debts
  add column if not exists bank_code text,
  add column if not exists bank_name text,
  add column if not exists original_amount numeric(14, 2),
  add column if not exists current_balance numeric(14, 2),
  add column if not exists monthly_installment numeric(14, 2),
  add column if not exists total_installment_count int,
  add column if not exists remaining_installment_count int,
  add column if not exists next_due_date date,
  add column if not exists statement_day int,
  add column if not exists user_minimum_payment numeric(14, 2),
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists note text;

-- Geriye uyum: yeni alanları eski alanlardan doldur.
update public.debts set current_balance = coalesce(current_balance, balance);
update public.debts set monthly_installment = coalesce(monthly_installment, installment);
update public.debts set bank_name = coalesce(bank_name, bank);
update public.debts set total_installment_count = coalesce(total_installment_count, term_count);
update public.debts
  set remaining_installment_count = coalesce(remaining_installment_count, term_count)
  where kind in ('loan', 'installment_kmh');
update public.debts
  set next_due_date = coalesce(next_due_date, first_installment_date)
  where kind in ('loan', 'installment_kmh') and first_installment_date is not null;
update public.debts set user_minimum_payment = coalesce(user_minimum_payment, user_minimum);

-- ---------------------------------------------------------------------------
-- 3) payment_occurrences — beklenen ödeme olayları
-- ---------------------------------------------------------------------------
create table if not exists public.payment_occurrences (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  debt_id       uuid references public.debts (id) on delete cascade,
  owner_type    text not null default 'person' check (owner_type in ('person', 'household')),
  person_id     uuid references public.persons (id) on delete set null,
  due_date      date not null,
  amount_due    numeric(14, 2) not null default 0,
  amount_paid   numeric(14, 2) not null default 0,
  status        text not null default 'pending'
                check (status in ('pending', 'partial', 'paid', 'overdue', 'skipped')),
  kind          text not null, -- credit_card_minimum | loan_installment | installment_kmh | kmh_manual | custom
  installment_no     int,
  total_installments int,
  bank_code     text,
  bank_name     text,
  label         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_po_household on public.payment_occurrences (household_id);
create index if not exists idx_po_debt on public.payment_occurrences (debt_id);
create index if not exists idx_po_due on public.payment_occurrences (due_date);
-- Aynı borç + vade + tür için tek occurrence (idempotent üretim).
create unique index if not exists uq_po_debt_due_kind
  on public.payment_occurrences (debt_id, due_date, kind);

drop trigger if exists touch_po on public.payment_occurrences;
create trigger touch_po before update on public.payment_occurrences
  for each row execute function public.touch_updated_at();

alter table public.payment_occurrences enable row level security;
drop policy if exists "po all" on public.payment_occurrences;
create policy "po all" on public.payment_occurrences for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- 4) Bildirim tercihleri: 7/3/1/son gün + gecikme + kapsam
-- ---------------------------------------------------------------------------
alter table public.notification_prefs
  add column if not exists remind_7d boolean not null default true,
  add column if not exists remind_3d boolean not null default true,
  add column if not exists remind_1d boolean not null default true,
  add column if not exists remind_due_day boolean not null default true,
  add column if not exists remind_overdue boolean not null default true,
  add column if not exists scope text not null default 'all' check (scope in ('own', 'household', 'all'));

-- reminders_log: occurrence bazlı idempotency + kind serbest metin
alter table public.reminders_log drop constraint if exists reminders_log_kind_check;
alter table public.reminders_log add column if not exists occurrence_id uuid;
create unique index if not exists uq_rl_occurrence
  on public.reminders_log (occurrence_id, member_id, channel, kind);

