-- v2.4 — Abonelik doğrulama alanları + hane entitlement modeli.
-- Model kararı (minimum değişiklik): abonelik ÖDEYEN kullanıcıya (entitlements.user_id) aittir.
-- Bir HANE, sahibinin (owner) aktif premium'u varsa premium özelliklerden yararlanır.
-- Aynı transaction'ın iki kullanıcıya bağlanması / replay unique index ile engellenir.

alter table public.entitlements
  add column if not exists original_transaction_id text,
  add column if not exists latest_transaction_id text,
  add column if not exists environment text; -- 'sandbox' | 'production'

-- Replay & cross-user binding koruması: bir subscription transaction'ı tek kullanıcıya.
create unique index if not exists entitlements_txn_unique
  on public.entitlements (platform, original_transaction_id)
  where original_transaction_id is not null;

-- Aktif premium sayılan durumlar. cancelled → yalnız doğrulanmış expiry gelecekteyse erişir.
-- expired / refunded / revoked → asla erişim.
create or replace function public.current_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select e.plan from public.entitlements e
       where e.user_id = uid
         and (
           e.subscription_status in ('active', 'trial', 'grace_period', 'billing_retry')
           or (e.subscription_status = 'cancelled'
               and e.premium_until is not null and e.premium_until >= now())
         )
         and (e.premium_until is null or e.premium_until >= now())
       limit 1),
    'free');
$$;

create or replace function public.has_active_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_plan(uid) <> 'free';
$$;

create or replace function public.plan_person_limit(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select case public.current_plan(uid)
    when 'family_4' then 4
    when 'family_5' then 5
    when 'family_6' then 6
    when 'family_7' then 7
    else 1 end;
$$;

-- Hane, sahibinin premium'undan yararlanır.
create or replace function public.household_has_premium(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.role = 'owner'
      and public.has_active_premium(m.member_id)
  );
$$;

-- Hane kişi limiti = premium sahiplerin en yüksek plan limiti; premium yoksa 1.
create or replace function public.household_person_limit(hh uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(public.plan_person_limit(m.member_id))
       from public.household_members m
      where m.household_id = hh and m.role = 'owner'
        and public.has_active_premium(m.member_id)),
    1);
$$;
