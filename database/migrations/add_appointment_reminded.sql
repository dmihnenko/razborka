-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Отметка об отправке напоминания клиенту по записи                          ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

COMMENT ON COLUMN appointments.reminded_at IS 'Когда клиенту отправлено напоминание о записи';

NOTIFY pgrst, 'reload schema';

SELECT 'appointment reminded_at ready' AS status;
