-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  get_public_invoice: добавляем в данные авто пробег и год                   ║
-- ║  Идемпотентно (CREATE OR REPLACE). Применять в Supabase → SQL editor.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

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
  SELECT brand, model, license_plate, vin, mileage, year INTO veh FROM vehicles WHERE id = inv.vehicle_id;

  RETURN jsonb_build_object(
    'invoice',  to_jsonb(inv),
    'company',  to_jsonb(comp),
    'customer', to_jsonb(cust),
    'vehicle',  to_jsonb(veh)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_invoice(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'get_public_invoice updated' AS status;
