-- Добавляем колонку duration_minutes в таблицу appointments
-- Применить в: Supabase Dashboard → SQL Editor → Run

alter table appointments
  add column if not exists duration_minutes integer default null;

comment on column appointments.duration_minutes is 'Длительность записи в минутах (вычисляется из диапазона начала-конца)';
