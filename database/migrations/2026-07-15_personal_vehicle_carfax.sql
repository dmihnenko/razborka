-- Ссылка на CarFax-отчёт у личного авто (опционально, по одной на машину).
alter table public.personal_vehicles add column if not exists carfax_url text;
