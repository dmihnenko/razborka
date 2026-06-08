-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Авто: объём двигателя и тип топлива                                        ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS engine_volume numeric(4,1),
  ADD COLUMN IF NOT EXISTS fuel_type text;

COMMENT ON COLUMN vehicles.engine_volume IS 'Объём двигателя, л (напр. 1.6)';
COMMENT ON COLUMN vehicles.fuel_type IS 'Тип топлива: Бензин/Дизель/Электро/Гибрид/Газ';

NOTIFY pgrst, 'reload schema';

SELECT 'vehicle engine/fuel ready' AS status;
