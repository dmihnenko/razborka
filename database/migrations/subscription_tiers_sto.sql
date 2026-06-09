-- Тарифы СТО: Стандарт / Про / Макс / Персональный (вместо подписок по сроку).
-- Лимиты и цены редактируются админом. Срок выбирается при покупке (месяц / год −15%).
-- Идемпотентно: апсерт по (company_type, name).

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- Старые платные планы СТО выводим из показа (демо с price=0 оставляем для триала)
UPDATE subscriptions SET is_active = false
WHERE company_type = 'sto' AND price > 0
  AND name NOT IN ('Стандарт', 'Про', 'Макс', 'Персональный');

DO $$
DECLARE
  tiers jsonb := '[
    {"name":"Стандарт","price":500,"workers":3,"appts":50,"customers":100,"sort":1,"custom":false,"desc":"3 механика · 50 заявок/мес · 100 клиентов и их авто"},
    {"name":"Про","price":750,"workers":6,"appts":100,"customers":200,"sort":2,"custom":false,"desc":"6 механиков · 100 заявок/мес · 200 клиентов и их авто"},
    {"name":"Макс","price":1000,"workers":10,"appts":300,"customers":500,"sort":3,"custom":false,"desc":"10 механиков · 300 заявок/мес · 500 клиентов и их авто"},
    {"name":"Персональный","price":0,"workers":null,"appts":null,"customers":null,"sort":4,"custom":true,"desc":"Индивидуальные условия — обсуждается отдельно"}
  ]'::jsonb;
  t jsonb;
  existing_id uuid;
BEGIN
  FOR t IN SELECT * FROM jsonb_array_elements(tiers) LOOP
    SELECT id INTO existing_id FROM subscriptions
      WHERE company_type = 'sto' AND name = (t->>'name') LIMIT 1;

    IF existing_id IS NULL THEN
      INSERT INTO subscriptions (name, type, price, description, company_type, is_active,
        max_workers, max_appointments, max_customers, duration_months, sort_order, is_custom)
      VALUES (
        t->>'name', 'monthly', (t->>'price')::numeric, t->>'desc', 'sto', true,
        NULLIF(t->>'workers','')::int, NULLIF(t->>'appts','')::int, NULLIF(t->>'customers','')::int,
        1, (t->>'sort')::int, (t->>'custom')::boolean
      );
    ELSE
      UPDATE subscriptions SET
        type = 'monthly', price = (t->>'price')::numeric, description = t->>'desc', is_active = true,
        max_workers      = NULLIF(t->>'workers','')::int,
        max_appointments = NULLIF(t->>'appts','')::int,
        max_customers    = NULLIF(t->>'customers','')::int,
        sort_order = (t->>'sort')::int,
        is_custom  = (t->>'custom')::boolean
      WHERE id = existing_id;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
