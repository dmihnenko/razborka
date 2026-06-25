-- Курс USD разборки — хранить в БД (а не только в localStorage браузера).
-- Проблема: ручной курс жил в localStorage → терялся при чистке данных сайта и не был
-- общим между устройствами (ноут/ПК) → откатывался на хардкод-дефолт 41.
-- Решение: курс на уровне parts_companies (общий для команды, переживает чистку/смену устройства).

alter table public.parts_companies add column if not exists usd_rate numeric;
alter table public.parts_companies add column if not exists usd_rate_date date;
alter table public.parts_companies add column if not exists usd_rate_source text; -- 'manual' | 'privatbank'

-- Обновление курса своей компании. SECURITY DEFINER → может ЛЮБОЙ член компании
-- (не только владелец), при этом строго свою компанию (my_parts_company_id()).
create or replace function public.set_parts_usd_rate(p_rate numeric, p_source text default 'manual')
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company uuid;
begin
  v_company := public.my_parts_company_id();
  if v_company is null then
    raise exception 'no parts company for current user';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid rate';
  end if;
  update public.parts_companies
     set usd_rate = p_rate,
         usd_rate_date = current_date,
         usd_rate_source = coalesce(nullif(p_source, ''), 'manual')
   where id = v_company;
end;
$$;
revoke all on function public.set_parts_usd_rate(numeric, text) from public;
grant execute on function public.set_parts_usd_rate(numeric, text) to authenticated;
