-- Добавляем поддержку иерархии в категории услуг
ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES service_categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS service_categories_parent_id_idx ON service_categories(parent_id);
