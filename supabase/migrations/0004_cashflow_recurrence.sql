-- Düzeltme Spec'i 3: tek seferlik gelir/gider
alter table public.cash_flows
  add column if not exists recurrence text not null default 'monthly'
    check (recurrence in ('monthly', 'one_time')),
  add column if not exists occurred_on date;   -- one_time için (hangi ay)
