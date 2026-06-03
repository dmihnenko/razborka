-- Исправляем constraint статусов appointments чтобы включить все статусы используемые приложением
-- Применить в: Supabase Dashboard → SQL Editor → Run

alter table appointments drop constraint if exists appointments_status_check;

alter table appointments add constraint appointments_status_check
  check (status in (
    'scheduled',
    'in_progress',
    'ready',
    'completed',
    'archived',
    'cancelled',
    'pending_deletion',
    'deleted'
  ));
