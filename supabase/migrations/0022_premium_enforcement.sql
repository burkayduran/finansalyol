-- v2.4 — Server-side premium koruması. RESTRICTIVE politikalar mevcut permissive
-- "for all" politikalarıyla AND'lenir; böylece premium şartı onları etkisiz bırakmaz.
-- Kontrollü rollout: enforcement_on() KAPALIYKEN tüm kontroller no-op'tur (mevcut davranış korunur),
-- yalnız AÇIKKEN premium şartı uygulanır. Bayrak app_config'te (istemci değiştiremez).

-- Varlık: premium hane şartı (insert + update)
drop policy if exists assets_premium_insert on public.assets;
create policy assets_premium_insert on public.assets
  as restrictive for insert
  with check (not public.enforcement_on() or public.household_has_premium(household_id));

drop policy if exists assets_premium_update on public.assets;
create policy assets_premium_update on public.assets
  as restrictive for update
  using (not public.enforcement_on() or public.household_has_premium(household_id));

-- Nakit akışı: premium hane şartı (insert + update)
drop policy if exists cash_flows_premium_insert on public.cash_flows;
create policy cash_flows_premium_insert on public.cash_flows
  as restrictive for insert
  with check (not public.enforcement_on() or public.household_has_premium(household_id));

drop policy if exists cash_flows_premium_update on public.cash_flows;
create policy cash_flows_premium_update on public.cash_flows
  as restrictive for update
  using (not public.enforcement_on() or public.household_has_premium(household_id));

-- Kişi (aile) özelliği premium: yeni kişi eklemek premium hane gerektirir.
-- NOT: create_household (security definer) ilk "Ben" kişisini RLS bypass ile ekler; bu politika
-- yalnız normal istemci insert'lerini etkiler.
drop policy if exists persons_premium_insert on public.persons;
create policy persons_premium_insert on public.persons
  as restrictive for insert
  with check (not public.enforcement_on() or public.household_has_premium(household_id));

-- Kişi limiti: concurrency-safe trigger (advisory lock ile eşzamanlı eklemede limit aşılmaz).
create or replace function public.enforce_person_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare cnt int; lim int;
begin
  if not public.enforcement_on() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.household_id::text));
  select count(*) into cnt from public.persons
    where household_id = new.household_id and is_archived = false;
  lim := public.household_person_limit(new.household_id);
  if cnt >= lim then
    raise exception 'Plan kişi limiti aşıldı (en fazla %)', lim using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_person_limit on public.persons;
create trigger trg_person_limit before insert on public.persons
  for each row execute function public.enforce_person_limit();
