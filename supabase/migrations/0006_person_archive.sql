-- MVP v1.2 — kişi arşivleme (silme yerine). Finansal verisi olan kişi silinmez.
alter table public.persons add column if not exists is_archived boolean not null default false;
