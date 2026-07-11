-- v2.2 — Server-side entitlement iskeleti (plan). Şimdilik yalnız SALT-OKUR yardımcılar
-- eklenir (uygulamayı bozmaz). Zorlama (RLS/trigger) TEMPLATE olarak yorumda; ancak
-- backend makbuz doğrulaması `entitlements` tablosunu doldurmaya başladıktan SONRA açılır
-- (aksi halde entitlements satırı olmayan mevcut kullanıcılar premium tablolara yazamaz).

-- Aktif plan: entitlements'ta aktif + süresi geçmemiş abonelik; yoksa 'free'.
create or replace function public.current_plan(uid uuid) returns text
language sql stable as $$
  select coalesce(
    (select e.plan from public.entitlements e
       where e.user_id = uid
         and e.subscription_status = 'active'
         and (e.premium_until is null or e.premium_until >= now())
       limit 1),
    'free');
$$;

create or replace function public.has_active_premium(uid uuid) returns boolean
language sql stable as $$
  select public.current_plan(uid) <> 'free';
$$;

create or replace function public.plan_person_limit(uid uuid) returns int
language sql stable as $$
  select case public.current_plan(uid)
    when 'family_4' then 4
    when 'family_5' then 5
    when 'family_6' then 6
    when 'family_7' then 7
    else 1 end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ZORLAMA TEMPLATE'LERİ (backend receipt-verify entitlements'ı doldurunca AÇ):
--
-- 1) Premium tablolara insert'i plana bağla (assets / cash_flows):
--   alter table public.assets     enable row level security;
--   create policy assets_premium_insert on public.assets
--     for insert with check (public.has_active_premium(auth.uid()));
--   create policy cash_flows_premium_insert on public.cash_flows
--     for insert with check (public.has_active_premium(auth.uid()));
--
-- 2) Kişi limitini server tarafında koru (persons insert trigger):
--   create or replace function public.enforce_person_limit() returns trigger
--   language plpgsql as $$
--   declare cnt int; lim int;
--   begin
--     select count(*) into cnt from public.persons
--       where household_id = new.household_id and is_archived = false;
--     lim := public.plan_person_limit(auth.uid());
--     if cnt >= lim then
--       raise exception 'Plan kişi limiti aşıldı (% / %)', cnt, lim;
--     end if;
--     return new;
--   end $$;
--   create trigger trg_person_limit before insert on public.persons
--     for each row execute function public.enforce_person_limit();
--
-- 3) email_reminders / weekly digest: reminder-cron entitlements join'i ile filtrele.
-- ─────────────────────────────────────────────────────────────────────────────
