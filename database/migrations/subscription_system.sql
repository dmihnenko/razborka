-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Единая система подписок СТО и Разборки (модель «срок»)                     ║
-- ║                                                                            ║
-- ║  • По одному платному тарифу на тип (СТО / Разборка), покупается на        ║
-- ║    1/3/6/12 месяцев (длительность выбирается при оформлении).              ║
-- ║  • Бессрочный тариф — назначает только админ.                              ║
-- ║  • Активная подписка = полный доступ; без неё действует бесплатный лимит.  ║
-- ║  • Владелец оставляет заявку, админ подтверждает (онлайн-оплаты нет).      ║
-- ║                                                                            ║
-- ║  Идемпотентно. Применять в Supabase → SQL editor.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Канонические планы (только существующие колонки) ──────────────────────
-- Цены — базовые/информативные, админ может менять. Месячная цена; стоимость
-- за 3/6/12 мес считается на клиенте из конфига.

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Подписка СТО', 'monthly', 499, 'sto', 'Полный доступ к функциям СТО', true
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Подписка СТО' AND company_type = 'sto');

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Подписка Разборка', 'monthly', 399, 'parts', 'Полный доступ к функциям авторазборки', true
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Подписка Разборка' AND company_type = 'parts');

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Бессрочная СТО', 'lifetime', 9999, 'sto', 'Бессрочный доступ (назначает администратор)', true
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Бессрочная СТО' AND company_type = 'sto');

INSERT INTO subscriptions (name, type, price, company_type, description, is_active)
SELECT 'Бессрочная Разборка', 'lifetime', 7999, 'parts', 'Бессрочный доступ (назначает администратор)', true
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Бессрочная Разборка' AND company_type = 'parts');

-- ─── 2. Деактивируем легаси платные тарифы (Старт/Бизнес/Профи/… ) ────────────
-- Демо (price = 0) и канонические планы остаются активными.
UPDATE subscriptions
SET is_active = false
WHERE is_active = true
  AND price > 0
  AND name NOT IN ('Подписка СТО', 'Подписка Разборка', 'Бессрочная СТО', 'Бессрочная Разборка');

-- ─── 3. Таблица заявок на подписку ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_type  VARCHAR(20) NOT NULL CHECK (company_type IN ('sto', 'parts')),
  company_id    UUID NOT NULL,
  requested_by  UUID,
  plan_id       UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  months        INT NOT NULL DEFAULT 1,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  processed_by  UUID
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_company ON subscription_requests(company_type, company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status  ON subscription_requests(status);

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

-- helper-условие администратора
-- (используем inline EXISTS, как в остальных политиках проекта)

DROP POLICY IF EXISTS "subreq_select" ON subscription_requests;
CREATE POLICY "subreq_select" ON subscription_requests
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
    OR (company_type = 'sto'   AND company_id IN (SELECT sto_company_id   FROM user_profiles WHERE id = auth.uid()))
    OR (company_type = 'parts' AND company_id IN (SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "subreq_insert" ON subscription_requests;
CREATE POLICY "subreq_insert" ON subscription_requests
  FOR INSERT
  WITH CHECK (
    (company_type = 'sto'   AND company_id IN (SELECT sto_company_id   FROM user_profiles WHERE id = auth.uid()))
    OR (company_type = 'parts' AND company_id IN (SELECT parts_company_id FROM user_profiles WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

DROP POLICY IF EXISTS "subreq_update" ON subscription_requests;
CREATE POLICY "subreq_update" ON subscription_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

DROP POLICY IF EXISTS "subreq_delete" ON subscription_requests;
CREATE POLICY "subreq_delete" ON subscription_requests
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

-- ─── Проверка ─────────────────────────────────────────────────────────────────
SELECT company_type, name, type, price, is_active
FROM subscriptions
WHERE is_active = true
ORDER BY company_type, price;
