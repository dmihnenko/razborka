-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Нормо-часы у работ каталога (вместо длительности в минутах)               ║
-- ║  Бэкфилл из duration_minutes/60. duration_minutes НЕ удаляем (совместимость)║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS norm_hours numeric(6,2);

-- Перенос существующих значений: минуты → нормо-часы
UPDATE services
  SET norm_hours = ROUND(duration_minutes::numeric / 60, 2)
  WHERE norm_hours IS NULL AND duration_minutes IS NOT NULL;

COMMENT ON COLUMN services.norm_hours IS 'Нормо-часы (дробное, напр. 1.5)';

SELECT 'services.norm_hours ready' AS status;
