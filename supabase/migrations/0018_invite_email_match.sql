-- v2.3 — Davet güvenliği: accept_invite artık daveti KABUL EDEN kullanıcının
-- e-postası ile davet e-postasının (normalize) aynı olmasını server-side doğrular.
-- Tek kullanımlık (status=accepted) + süre kontrolü korunur; auth.uid null guard eklenir.
-- security definer + sabit search_path korunur.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Oturum gerekli';
  end if;

  select lower(trim(email)) into v_email from auth.users where id = v_uid;

  select * into inv from public.household_invites
    where code = p_code and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'Davet bulunamadı veya süresi dolmuş';
  end if;

  if v_email is null or lower(trim(inv.email)) <> v_email then
    raise exception 'Bu davet başka bir e-posta için oluşturulmuş';
  end if;

  insert into public.household_members (household_id, member_id, role)
  values (inv.household_id, v_uid, 'member')
  on conflict (household_id, member_id) do nothing;

  update public.household_invites set status = 'accepted' where id = inv.id;
  return inv.household_id;
end;
$$;
