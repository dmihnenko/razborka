-- ========================================
-- ИСПРАВЛЕНИЕ ПОЛИТИКИ УДАЛЕНИЯ КЛИЕНТОВ
-- ========================================
-- Проблема: политика проверяет sto_company_id, но он может быть NULL
-- Решение: проверяем роль без привязки к компании для admin

-- Удаляем старые политики
DROP POLICY IF EXISTS "Allow authenticated users to delete customers" ON customers;
DROP POLICY IF EXISTS "Allow admin and sto_owner to delete customers" ON customers;

-- Создаем новую политику DELETE
-- Админы могут удалять любых клиентов
-- Владельцы СТО могут удалять только клиентов своей компании
CREATE POLICY "Allow admin and sto_owner to delete customers"
  ON customers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      JOIN user_roles ur ON ur.user_id = up.id
      JOIN roles r ON r.id = ur.role_id
      WHERE up.id = auth.uid()
      AND (
        -- Админ может удалять всех
        r.name = 'admin'
        OR 
        -- Владелец СТО может удалять клиентов своей компании
        (r.name = 'sto_owner' AND up.sto_company_id = customers.sto_company_id)
      )
    )
  );

-- Проверяем созданные политики
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'customers' AND cmd = 'DELETE'
ORDER BY policyname;
