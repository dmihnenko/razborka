-- Публичное чтение мест хранения для QR-этикеток (/public/parts-location/:id).
-- Анонимный сканер должен увидеть название места и его поддерево, чтобы показать
-- запчасти, лежащие в этом месте. Ограничиваем активными компаниями — как у
-- публичной политики parts_companies ("Public can view active parts companies").
DROP POLICY IF EXISTS parts_storage_locations_public_select ON parts_storage_locations;
CREATE POLICY parts_storage_locations_public_select
  ON parts_storage_locations
  FOR SELECT
  TO anon
  USING (
    parts_company_id IN (SELECT id FROM parts_companies WHERE is_active = true)
  );
