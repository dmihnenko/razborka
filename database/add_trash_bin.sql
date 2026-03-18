-- ============================================================================
-- Создание таблицы корзины (trash_bin)
-- Хранит удалённые сущности с возможностью восстановления в течение 30 дней
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trash_bin (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  entity_data      JSONB NOT NULL,
  entity_label     TEXT NOT NULL,
  deleted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sto_company_id   UUID,
  parts_company_id UUID REFERENCES public.parts_companies(id) ON DELETE CASCADE,
  deleted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Индексы для быстрой фильтрации по компании
CREATE INDEX IF NOT EXISTS idx_trash_bin_sto_company    ON public.trash_bin(sto_company_id);
CREATE INDEX IF NOT EXISTS idx_trash_bin_parts_company  ON public.trash_bin(parts_company_id);
CREATE INDEX IF NOT EXISTS idx_trash_bin_entity_type    ON public.trash_bin(entity_type);
CREATE INDEX IF NOT EXISTS idx_trash_bin_expires_at     ON public.trash_bin(expires_at);

-- Разрешаем все операции (RLS не нужен — доступ через anon key с политиками на уровне компании)
GRANT ALL ON public.trash_bin TO anon;
GRANT ALL ON public.trash_bin TO authenticated;
