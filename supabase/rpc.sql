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

-- Not: household_summary kaldırıldı (0009). Net durum tek doğruluk kaynağı client
-- core'dur (outstandingBalance mantığı); atomik ödeme RPC'leri 0009_payment_rpc.sql'de.
