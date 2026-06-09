-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  График работы СТО (часы открытия/закрытия) — для сетки выбора времени      ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE sto_companies
  ADD COLUMN IF NOT EXISTS work_open  smallint DEFAULT 9,
  ADD COLUMN IF NOT EXISTS work_close smallint DEFAULT 19;

COMMENT ON COLUMN sto_companies.work_open  IS 'Час открытия СТО (0–23)';
COMMENT ON COLUMN sto_companies.work_close IS 'Час закрытия СТО (1–24)';

NOTIFY pgrst, 'reload schema';

SELECT 'sto work hours ready' AS status;
