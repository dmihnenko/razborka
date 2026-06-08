-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Нормо-часы и снимок ставки на записи                                       ║
-- ║  extra_hours — доп. время для работы с авто клиента. Идемпотентно.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS extra_hours      numeric(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_norm_hours numeric(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_rate       numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN appointments.extra_hours      IS 'Доп. время для работы с авто клиента (н·ч)';
COMMENT ON COLUMN appointments.total_norm_hours IS 'Сумма нормо-часов каталожных работ (без extra_hours)';
COMMENT ON COLUMN appointments.labor_rate       IS 'Снимок ставки нормо-часа на момент записи';

SELECT 'appointments norm-hours ready' AS status;
