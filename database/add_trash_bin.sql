-- Корзина: временное хранение удалённых объектов (7 дней)
CREATE TABLE IF NOT EXISTS public.trash_bin (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,           -- 'customer' | 'vehicle' | 'service' | 'parts_vehicle' | ...
  entity_id    UUID NOT NULL,           -- оригинальный ID удалённой записи
  entity_data  JSONB NOT NULL,          -- полный снимок данных (включая связанные)
  entity_label TEXT NOT NULL,           -- читаемое название (для отображения в корзине)
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by   UUID REFERENCES auth.users(id),
  sto_company_id   UUID REFERENCES sto_companies(id)   ON DELETE CASCADE,
  parts_company_id UUID REFERENCES parts_companies(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

ALTER TABLE public.trash_bin ENABLE ROW LEVEL SECURITY;

-- SELECT: видят все сотрудники своей компании
CREATE POLICY "trash_select" ON public.trash_bin
  FOR SELECT USING (
    (sto_company_id IS NOT NULL AND sto_company_id IN (
      SELECT sto_company_id FROM user_profiles
      WHERE id = auth.uid() AND sto_company_id IS NOT NULL
    ))
    OR
    (parts_company_id IS NOT NULL AND parts_company_id IN (
      SELECT parts_company_id FROM user_profiles
      WHERE id = auth.uid() AND parts_company_id IS NOT NULL
    ))
  );

-- INSERT: сотрудник компании может класть в корзину
CREATE POLICY "trash_insert" ON public.trash_bin
  FOR INSERT WITH CHECK (
    (sto_company_id IS NOT NULL AND sto_company_id IN (
      SELECT sto_company_id FROM user_profiles
      WHERE id = auth.uid() AND sto_company_id IS NOT NULL
    ))
    OR
    (parts_company_id IS NOT NULL AND parts_company_id IN (
      SELECT parts_company_id FROM user_profiles
      WHERE id = auth.uid() AND parts_company_id IS NOT NULL
    ))
  );

-- DELETE: сотрудник компании может удалять из корзины
CREATE POLICY "trash_delete" ON public.trash_bin
  FOR DELETE USING (
    (sto_company_id IS NOT NULL AND sto_company_id IN (
      SELECT sto_company_id FROM user_profiles
      WHERE id = auth.uid() AND sto_company_id IS NOT NULL
    ))
    OR
    (parts_company_id IS NOT NULL AND parts_company_id IN (
      SELECT parts_company_id FROM user_profiles
      WHERE id = auth.uid() AND parts_company_id IS NOT NULL
    ))
  );

-- Индексы для быстрой выборки
CREATE INDEX IF NOT EXISTS trash_bin_sto_company_idx   ON public.trash_bin (sto_company_id);
CREATE INDEX IF NOT EXISTS trash_bin_parts_company_idx ON public.trash_bin (parts_company_id);
CREATE INDEX IF NOT EXISTS trash_bin_expires_idx       ON public.trash_bin (expires_at);
