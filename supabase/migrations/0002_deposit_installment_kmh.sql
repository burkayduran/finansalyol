-- F1 düzeltme migration'ı:
--  - assets: mevduat getiri alanları
--  - debts: taksitli KMH türü + taksit programı alanları

-- assets: mevduat getiri alanları
alter table public.assets
  add column if not exists annual_rate numeric(6,3),   -- yıllık faiz %, örn 45
  add column if not exists term_days   int,            -- vade (gün), örn 92
  add column if not exists stopaj      numeric(5,2),    -- stopaj %, örn 7.5
  add column if not exists start_date  date;            -- başlangıç, default bugün (uygulamada)

-- debts: taksitli KMH + program alanları
alter table public.debts drop constraint if exists debts_kind_check;
alter table public.debts add constraint debts_kind_check
  check (kind in ('credit_card','kmh','kmh_installment','loan'));

alter table public.debts
  add column if not exists term_count int,                 -- toplam taksit sayısı
  add column if not exists first_installment_date date;     -- ilk taksit tarihi
