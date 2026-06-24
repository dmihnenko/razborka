-- Расширенная модель статусов заказа: Новый → Сборка → Отправлен → Завершён (+ Отменён).
-- Спека: docs/order-status-spec.md. Применено вручную через Management API.
--
-- 1) Маппинг существующих данных: in_progress → assembling.
-- 2) CHECK-constraint расширен (in_progress оставлен как легаси-толерантность на время деплоя).
-- 3) RPC get_parts_dashboard_stats.orders дополнен счётчиками assembling/shipped (см. ниже).
--
-- Инвентарь по этапам (логика в коде, не в БД):
--   • авторезерв при добавлении позиции в заказ (createPartsOrderItem: available → reserved);
--   • cancelled → позиции в наличие; completed → sold (триггер complete_parts_order, уже есть);
--   • new/assembling/shipped → reserved.
-- Авто-shipped при создании ТТН (onTtnCreated). Авто-delivered из НП НЕ делаем (статуса «Доставлен» нет).

update public.parts_orders set status='assembling' where status='in_progress';

alter table public.parts_orders drop constraint parts_orders_status_check;
alter table public.parts_orders add constraint parts_orders_status_check
  check (status in ('new','assembling','shipped','in_progress','completed','cancelled'));

-- get_parts_dashboard_stats.orders: добавлены 'assembling' (assembling+in_progress) и 'shipped'.
-- Полное тело функции — в 2026-06-24_dashboard_stats_period.sql (там же profit/period); здесь только
-- отметка, что блок orders теперь возвращает new/assembling/shipped/in_progress/completed.
