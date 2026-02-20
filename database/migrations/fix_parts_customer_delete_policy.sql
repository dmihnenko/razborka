-- ========================================
-- ИСПРАВЛЕНИЕ ПОЛИТИКИ УДАЛЕНИЯ КЛИЕНТОВ РАЗБОРКИ
-- ========================================
-- Обеспечиваем, что владельцы разборки могут удалять своих клиентов
-- Админы могут удалять любых клиентов разборки

-- Удаляем старые политики
DROP POLICY IF EXISTS "Parts owners can delete customers" ON parts_customers;
DROP POLICY IF EXISTS "Allow admin and parts_owner to delete parts_customers" ON parts_customers;

-- Создаем новую политику DELETE
-- Админы могут удалять любых клиентов
-- Владельцы разборки могут удалять только клиентов своей компании
CREATE POLICY "Allow admin and parts_owner to delete parts_customers"
  ON parts_customers FOR DELETE
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
        -- Владелец разборки может удалять клиентов своей компании
        (r.name = 'parts_owner' AND up.parts_company_id = parts_customers.parts_company_id)
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
WHERE tablename = 'parts_customers' AND cmd = 'DELETE'
ORDER BY policyname;
