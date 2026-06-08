-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Счета СТО (sto_invoices)                                                   ║
-- ║  Снимок позиций заявки + наценка на запчасти, печать, публичная ссылка.    ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                          ║
-- ║                                                                            ║
-- ║  ВАЖНО: таблица называется sto_invoices, а НЕ invoices — в базе уже есть    ║
-- ║  легаси-таблица invoices (work_order_id-биллинг из schema.sql) с другой     ║
-- ║  схемой. Используем отдельное имя, чтобы не было коллизии.                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS sto_invoices (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sto_company_id    uuid NOT NULL,
  invoice_number    text,
  customer_id       uuid,
  vehicle_id        uuid,
  appointment_id    uuid,
  issued_at         timestamptz DEFAULT now(),
  work_items        jsonb DEFAULT '[]'::jsonb,   -- [{name, quantity, price, total}]
  part_items        jsonb DEFAULT '[]'::jsonb,   -- [{name, quantity, unitPrice, total}] (база, до наценки)
  parts_markup_pct  numeric DEFAULT 0,
  total_work        numeric DEFAULT 0,
  total_parts_base  numeric DEFAULT 0,
  total_parts       numeric DEFAULT 0,           -- после наценки
  total             numeric DEFAULT 0,
  note              text,
  status            text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid')),
  public_token      text UNIQUE DEFAULT replace(uuid_generate_v4()::text, '-', ''),
  created_by        uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Самовосстановление: если sto_invoices уже была создана раньше в урезанном виде,
-- доращиваем недостающие колонки (безопасно при повторном запуске).
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS sto_company_id   uuid;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS invoice_number   text;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS customer_id      uuid;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS vehicle_id       uuid;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS appointment_id   uuid;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS issued_at        timestamptz DEFAULT now();
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS work_items       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS part_items       jsonb DEFAULT '[]'::jsonb;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS parts_markup_pct numeric DEFAULT 0;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS total_work       numeric DEFAULT 0;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS total_parts_base numeric DEFAULT 0;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS total_parts      numeric DEFAULT 0;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS total            numeric DEFAULT 0;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS note             text;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS status           text DEFAULT 'issued';
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS public_token     text DEFAULT replace(uuid_generate_v4()::text, '-', '');
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS created_by       uuid;
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();
ALTER TABLE sto_invoices ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sto_invoices_company  ON sto_invoices(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_sto_invoices_customer ON sto_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sto_invoices_token    ON sto_invoices(public_token);

-- ─── RLS: доступ членам компании (паттерн из extend_appointments.sql) ─────────
ALTER TABLE sto_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sto_invoices_all" ON sto_invoices;
CREATE POLICY "sto_invoices_all" ON sto_invoices
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.sto_company_id = sto_invoices.sto_company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.sto_company_id = sto_invoices.sto_company_id
    )
  );

-- ─── Номер счёта (автоинкремент по компании) ──────────────────────────────────
CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  SELECT count(*) + 1 INTO n FROM sto_invoices WHERE sto_company_id = p_company_id;
  RETURN 'СЧ-' || lpad(n::text, 6, '0');
END;
$$;

-- ─── Публичный счёт по токену (для страницы-ссылки, без авторизации) ──────────
CREATE OR REPLACE FUNCTION get_public_invoice(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv  sto_invoices;
  comp record;
  cust record;
  veh  record;
BEGIN
  SELECT * INTO inv FROM sto_invoices WHERE public_token = p_token;
  IF inv.id IS NULL THEN RETURN NULL; END IF;

  SELECT name, phone, address, email INTO comp FROM sto_companies WHERE id = inv.sto_company_id;
  SELECT name, phone INTO cust FROM customers WHERE id = inv.customer_id;
  SELECT brand, model, license_plate, vin INTO veh FROM vehicles WHERE id = inv.vehicle_id;

  RETURN jsonb_build_object(
    'invoice',  to_jsonb(inv),
    'company',  to_jsonb(comp),
    'customer', to_jsonb(cust),
    'vehicle',  to_jsonb(veh)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION generate_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_invoice(text) TO anon, authenticated;

-- ─── Проверка ─────────────────────────────────────────────────────────────────
SELECT 'sto_invoices ready' AS status;
