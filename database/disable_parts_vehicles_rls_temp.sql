-- ВРЕМЕННО отключить RLS для parts_vehicles (только для разработки!)
ALTER TABLE parts_vehicles DISABLE ROW LEVEL SECURITY;

-- Чтобы включить обратно:
-- ALTER TABLE parts_vehicles ENABLE ROW LEVEL SECURITY;
