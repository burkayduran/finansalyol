-- v1.7 — RPC güvenlik yaması (0010'un üstüne, append-only).
-- record_payment: occurrence araması artık household_id + debt_id ile yapılır
-- (önerilen daha güvenli sorgu). Negatif/sıfır tutar reddi 0010'dan korunur.
-- Ham ödeme mantığı, RLS ve reverse_payment aynen kalır.

create or replace function public.record_payment(
  p_household uuid, p_debt uuid, p_occurrence uuid,
  p_amount numeric, p_paid_at date, p_note text default null
) returns void language plpgsql as $$
declare
  d public.debts%rowtype;
  o public.payment_occurrences%rowtype;
  v_inst numeric; v_covered int; v_rem int; v_paid numeric; v_status text; v_bal numeric;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Tutar 0''dan büyük olmalı';
  end if;

  select * into d from public.debts where id = p_debt and household_id = p_household for update;
  if not found then raise exception 'Borç bulunamadı'; end if;

  insert into public.payments (household_id, debt_id, occurrence_id, owner_type, person_id, amount, paid_at, note)
  values (p_household, p_debt, p_occurrence, d.owner_type, d.person_id, p_amount, p_paid_at, p_note);

  if p_occurrence is not null then
    select * into o from public.payment_occurrences
      where id = p_occurrence and household_id = p_household and debt_id = p_debt for update;
    if not found then raise exception 'Ödeme kaydı bu borca ait değil'; end if;
    v_paid := o.amount_paid + p_amount;
    v_status := case
      when o.status = 'skipped' then 'skipped'
      when o.amount_due > 0 and v_paid >= o.amount_due then 'paid'
      when o.due_date < v_today then 'overdue'
      when v_paid > 0 then 'partial'
      else 'pending' end;
    update public.payment_occurrences set amount_paid = v_paid, status = v_status where id = o.id;
  end if;

  v_bal := greatest(0, coalesce(d.current_balance, d.balance, 0) - p_amount);
  update public.debts set current_balance = v_bal, balance = v_bal where id = d.id;

  if d.kind in ('loan','installment_kmh') then
    v_inst := coalesce(d.monthly_installment, d.installment, 0);
    if v_inst > 0 and p_amount >= v_inst then
      v_covered := floor(p_amount / v_inst)::int;
      v_rem := greatest(0, coalesce(d.remaining_installment_count, d.term_count, 0) - v_covered);
      update public.debts set
        remaining_installment_count = v_rem,
        next_due_date = case when next_due_date is not null
                             then (next_due_date + make_interval(months => v_covered))::date
                             else next_due_date end,
        is_active = case when v_rem = 0 then false else is_active end
      where id = d.id;
    end if;
  end if;
end $$;
