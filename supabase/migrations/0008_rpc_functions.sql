-- RPC fonksiyonları — istemcinin RLS yumurta-tavuk durumlarını aşması için.

-- Hane kur + kurucuyu owner üye yap (tek transaction).
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  hh uuid;
begin
  insert into public.households (name, created_by)
  values (p_name, auth.uid())
  returning id into hh;

  insert into public.household_members (household_id, member_id, role)
  values (hh, auth.uid(), 'owner');

  -- Kurucuyu aynı zamanda bir "kişi" olarak da ekle (borç bağlanabilsin).
  insert into public.persons (household_id, display_name, linked_member_id)
  values (hh, coalesce((select full_name from public.profiles where id = auth.uid()), 'Ben'), auth.uid());

  return hh;
end;
$$;

-- Davet kodunu kabul et -> üyeyi haneye ekle.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
begin
  select * into inv from public.household_invites
  where code = p_code and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Davet bulunamadı veya süresi dolmuş';
  end if;

  insert into public.household_members (household_id, member_id, role)
  values (inv.household_id, auth.uid(), 'member')
  on conflict (household_id, member_id) do nothing;

  update public.household_invites set status = 'accepted' where id = inv.id;
  return inv.household_id;
end;
$$;

-- Hane özeti: toplam borç, toplam varlık, net durum (pano kalbi).
create or replace function public.household_summary(hh uuid)
returns table (total_debt numeric, total_asset numeric, net numeric)
language sql
security definer set search_path = public
stable
as $$
  select
    coalesce((select sum(balance) from public.debts  where household_id = hh), 0) as total_debt,
    coalesce((select sum(balance) from public.assets where household_id = hh), 0) as total_asset,
    coalesce((select sum(balance) from public.assets where household_id = hh), 0)
      - coalesce((select sum(balance) from public.debts where household_id = hh), 0) as net
  where public.is_household_member(hh);
$$;
