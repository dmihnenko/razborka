-- Тарифы РАЗБОРКИ: Стандарт / Про / Макс / Персональный.
-- Лимиты разборки — машины (vehicles) и запчасти (parts). Цены — дефолтные, правятся админом.
-- Идемпотентно: апсерт по (company_type, name).

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_vehicles int DEFAULT NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_parts    int DEFAULT NULL;
-- на случай, если запускается раньше sto-миграции
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- Старые платные планы разборки выводим из показа (демо price=0 оставляем)
UPDATE subscriptions SET is_active = false
WHERE company_type = 'parts' AND price > 0
  AND name NOT IN ('Стандарт', 'Про', 'Макс', 'Персональный');

DO $$
DECLARE
  tiers jsonb := '[
    {"name":"Стандарт","price":400,"vehicles":1,"parts":100,"sort":1,"custom":false,"desc":"1 машина · 100 запчастей"},
    {"name":"Про","price":600,"vehicles":2,"parts":300,"sort":2,"custom":false,"desc":"2 машины · 300 запчастей"},
    {"name":"Макс","price":900,"vehicles":5,"parts":800,"sort":3,"custom":false,"desc":"5 машин · 800 запчастей"},
    {"name":"Персональный","price":0,"vehicles":null,"parts":null,"sort":4,"custom":true,"desc":"Индивидуальные условия — обсуждается отдельно"}
  ]'::jsonb;
  t jsonb;
  existing_id uuid;
BEGIN
  FOR t IN SELECT * FROM jsonb_array_elements(tiers) LOOP
    SELECT id INTO existing_id FROM subscriptions
      WHERE company_type = 'parts' AND name = (t->>'name') LIMIT 1;

    IF existing_id IS NULL THEN
      INSERT INTO subscriptions (name, type, price, description, company_type, is_active,
        max_vehicles, max_parts, duration_months, sort_order, is_custom)
      VALUES (
        t->>'name', 'monthly', (t->>'price')::numeric, t->>'desc', 'parts', true,
        NULLIF(t->>'vehicles','')::int, NULLIF(t->>'parts','')::int,
        1, (t->>'sort')::int, (t->>'custom')::boolean
      );
    ELSE
      UPDATE subscriptions SET
        type = 'monthly', price = (t->>'price')::numeric, description = t->>'desc', is_active = true,
        max_vehicles = NULLIF(t->>'vehicles','')::int,
        max_parts    = NULLIF(t->>'parts','')::int,
        sort_order = (t->>'sort')::int,
        is_custom  = (t->>'custom')::boolean
      WHERE id = existing_id;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
