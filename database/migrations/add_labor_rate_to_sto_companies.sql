-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Ставка нормо-часа для СТО                                                  ║
-- ║  Цена работ в каталоге = нормо-часы × ставку. Идемпотентно.                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE sto_companies
  ADD COLUMN IF NOT EXISTS labor_rate numeric(10,2) DEFAULT 0;

UPDATE sto_companies SET labor_rate = 0 WHERE labor_rate IS NULL;

COMMENT ON COLUMN sto_companies.labor_rate IS 'Ставка нормо-часа (₴/н·ч)';

SELECT 'labor_rate ready' AS status;
