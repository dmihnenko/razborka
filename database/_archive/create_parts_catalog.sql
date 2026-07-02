-- Таблица для публичного каталога запчастей
CREATE TABLE IF NOT EXISTS parts_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  article TEXT, -- артикул/OEM номер
  price DECIMAL(10,2),
  old_price DECIMAL(10,2), -- для отображения скидки
  category TEXT NOT NULL, -- MODEL S, MODEL X, MODEL 3, MODEL Y
  subcategory TEXT, -- подкатегория (двигатель, кузов и т.д.)
  condition TEXT DEFAULT 'used', -- new, used, damaged
  in_stock BOOLEAN DEFAULT true,
  images TEXT[], -- массив URL фотографий
  vin TEXT, -- VIN автомобиля-донора
  year INTEGER, -- год выпуска донора
  
  -- Контакты разборки
  company_id UUID,
  contact_phone TEXT,
  contact_address TEXT,
  contact_name TEXT,
  working_hours TEXT,
  
  -- Теги для фильтрации
  tags TEXT[], -- новинка, хит продаж, распродажа
  
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_parts_catalog_category ON parts_catalog(category);
CREATE INDEX IF NOT EXISTS idx_parts_catalog_tags ON parts_catalog USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_parts_catalog_in_stock ON parts_catalog(in_stock);
CREATE INDEX IF NOT EXISTS idx_parts_catalog_company ON parts_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_parts_catalog_article ON parts_catalog(article);

-- Полнотекстовый поиск
CREATE INDEX IF NOT EXISTS idx_parts_catalog_search ON parts_catalog USING gin(to_tsvector('russian', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(article, '')));

-- RLS политики (публичное чтение)
ALTER TABLE parts_catalog ENABLE ROW LEVEL SECURITY;

-- Все могут читать
CREATE POLICY "parts_catalog_select_all" ON parts_catalog
  FOR SELECT
  USING (true);

-- Только владельцы компаний могут добавлять/редактировать свои запчасти
CREATE POLICY "parts_catalog_insert_company" ON parts_catalog
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "parts_catalog_update_company" ON parts_catalog
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "parts_catalog_delete_company" ON parts_catalog
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_parts_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parts_catalog_updated_at
  BEFORE UPDATE ON parts_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_catalog_timestamp();
