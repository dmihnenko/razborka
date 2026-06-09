-- Доводим удаление auth-пользователя: оставшиеся блокирующие FK переводим в SET NULL.
-- created_by / reviewed_by — не «личные» данные пользователя, поэтому связанные
-- строки НЕ удаляем, а просто обнуляем ссылку.

ALTER TABLE public.parts_vehicles DROP CONSTRAINT IF EXISTS parts_vehicles_created_by_fkey;
ALTER TABLE public.parts_vehicles
  ADD CONSTRAINT parts_vehicles_created_by_fkey FOREIGN KEY (created_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_reviewed_by_fkey;
ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by)
  REFERENCES auth.users(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
