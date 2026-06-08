-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Счета СТО (invoices)                                                       ║
-- ║  Снимок позиций заявки + наценка на запчасти, печать, публичная ссылка.    ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS invoices (
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

CREATE INDEX IF NOT EXISTS idx_invoices_company  ON invoices(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_token    ON invoices(public_token);

-- ─── RLS: доступ членам компании (как в add_appointments_rls.sql) ─────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices
  USING (
    sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    sto_company_id IN (SELECT sto_company_id FROM user_profiles WHERE id = auth.uid())
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
  SELECT count(*) + 1 INTO n FROM invoices WHERE sto_company_id = p_company_id;
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
  inv  invoices;
  comp record;
  cust record;
  veh  record;
BEGIN
  SELECT * INTO inv FROM invoices WHERE public_token = p_token;
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
SELECT 'invoices ready' AS status;
