-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Внешние ключи для sto_invoices → customers / vehicles                      ║
-- ║  Без FK PostgREST не умеет встраивать customers(...)/vehicles(...) и даёт    ║
-- ║  400 при создании/чтении счёта. Идемпотентно. Применять в Supabase.         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sto_invoices_customer_id_fkey') THEN
    ALTER TABLE sto_invoices
      ADD CONSTRAINT sto_invoices_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sto_invoices_vehicle_id_fkey') THEN
    ALTER TABLE sto_invoices
      ADD CONSTRAINT sto_invoices_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'sto_invoices FKs ready' AS status;
