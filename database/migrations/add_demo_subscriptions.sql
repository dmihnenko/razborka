-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Демо-подписка на 1 месяц для новых СТО и разборок                          ║
-- ║                                                                            ║
-- ║  При создании компании (sto_companies / parts_companies) владелец          ║
-- ║  автоматически получает бесплатную демо-подписку на 1 месяц, чтобы          ║
-- ║  ознакомиться с системой и наполнить её своими данными.                    ║
-- ║  (В таблице subscriptions нет колонок лимитов — активная подписка даёт      ║
-- ║   полный доступ; ограничения включаются только когда подписки нет.)        ║
-- ║                                                                            ║
-- ║  Идемпотентно — безопасно запускать повторно. Supabase → SQL editor.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Демо-планы (1 месяц, цена 0) ──────────────────────────────────────────

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Демо-подписка СТО', 'monthly', 0, 'sto',
       'Бесплатная демо-подписка на 1 месяц для новых СТО', true
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE company_type = 'sto' AND price = 0 AND type = 'monthly'
);

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Демо-подписка разборки', 'monthly', 0, 'parts',
       'Бесплатная демо-подписка на 1 месяц для новых разборок', true
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE company_type = 'parts' AND price = 0 AND type = 'monthly'
);

-- ─── 2. Функции назначения (SECURITY DEFINER → обходят RLS при самостоятельной
--        регистрации владельца; ошибки не ломают создание компании) ───────────

CREATE OR REPLACE FUNCTION assign_demo_subscription_to_sto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_subscription_id UUID;
BEGIN
  SELECT id INTO demo_subscription_id
  FROM subscriptions
  WHERE company_type = 'sto' AND price = 0 AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF demo_subscription_id IS NOT NULL THEN
    INSERT INTO company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active)
    VALUES
      ('sto', NEW.id, demo_subscription_id, NOW(), NOW() + INTERVAL '1 month', true)
    ON CONFLICT (company_type, company_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Не даём ошибке назначения подписки сорвать регистрацию компании
  RAISE WARNING 'assign_demo_subscription_to_sto failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_demo_subscription_to_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_subscription_id UUID;
BEGIN
  SELECT id INTO demo_subscription_id
  FROM subscriptions
  WHERE company_type = 'parts' AND price = 0 AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF demo_subscription_id IS NOT NULL THEN
    INSERT INTO company_subscriptions
      (company_type, company_id, subscription_id, start_date, end_date, is_active)
    VALUES
      ('parts', NEW.id, demo_subscription_id, NOW(), NOW() + INTERVAL '1 month', true)
    ON CONFLICT (company_type, company_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'assign_demo_subscription_to_parts failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── 3. Триггеры на создание компании ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_assign_demo_to_sto ON sto_companies;
CREATE TRIGGER trigger_assign_demo_to_sto
  AFTER INSERT ON sto_companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_demo_subscription_to_sto();

DROP TRIGGER IF EXISTS trigger_assign_demo_to_parts ON parts_companies;
CREATE TRIGGER trigger_assign_demo_to_parts
  AFTER INSERT ON parts_companies
  FOR EACH ROW
  EXECUTE FUNCTION assign_demo_subscription_to_parts();

COMMENT ON FUNCTION assign_demo_subscription_to_sto()   IS 'Назначает демо-подписку на 1 месяц новым СТО';
COMMENT ON FUNCTION assign_demo_subscription_to_parts() IS 'Назначает демо-подписку на 1 месяц новым разборкам';

-- ─── 4. Бэкофилл: выдать демо-подписку уже существующим компаниям без подписки ─
--        (UNIQUE(company_type, company_id) → ON CONFLICT DO NOTHING).

INSERT INTO company_subscriptions (company_type, company_id, subscription_id, start_date, end_date, is_active)
SELECT 'sto', sc.id,
       (SELECT id FROM subscriptions WHERE company_type = 'sto' AND price = 0 AND is_active = true ORDER BY created_at LIMIT 1),
       NOW(), NOW() + INTERVAL '1 month', true
FROM sto_companies sc
WHERE EXISTS (SELECT 1 FROM subscriptions WHERE company_type = 'sto' AND price = 0 AND is_active = true)
ON CONFLICT (company_type, company_id) DO NOTHING;

INSERT INTO company_subscriptions (company_type, company_id, subscription_id, start_date, end_date, is_active)
SELECT 'parts', pc.id,
       (SELECT id FROM subscriptions WHERE company_type = 'parts' AND price = 0 AND is_active = true ORDER BY created_at LIMIT 1),
       NOW(), NOW() + INTERVAL '1 month', true
FROM parts_companies pc
WHERE EXISTS (SELECT 1 FROM subscriptions WHERE company_type = 'parts' AND price = 0 AND is_active = true)
ON CONFLICT (company_type, company_id) DO NOTHING;

-- ─── Проверка ─────────────────────────────────────────────────────────────────
SELECT cs.company_type, count(*) AS active_demo
FROM company_subscriptions cs
JOIN subscriptions s ON s.id = cs.subscription_id
WHERE s.price = 0 AND cs.is_active = true
GROUP BY cs.company_type;
