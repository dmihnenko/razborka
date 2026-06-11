-- ============================================================================
-- Доступ админа к заявкам на доступ (access_requests)
-- ----------------------------------------------------------------------------
-- Симптом: владелец СТО регистрируется и подаёт заявку (видит свой статус
-- «Ожидает»), но админ не видит её в «Заявки на доступ».
--
-- Причина: на access_requests есть политика «видеть свою строку» (user_id =
-- auth.uid()), поэтому заявитель видит себя, но НЕТ политики, дающей админу
-- читать/обрабатывать чужие заявки → admin-запрос возвращает 0 строк.
--
-- Политики ниже ДОБАВЛЯЮТ доступ (permissive, объединяются через OR) — они не
-- ограничивают уже существующие политики «свою строку». Имена уникальны, чтобы
-- не затронуть ранее заведённые политики с другими именами.
-- Паттерн админа — inline EXISTS, как в subscription_system.sql и остальных.
-- ============================================================================

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Заявитель видит свои заявки (на случай, если такой политики ещё нет)
DROP POLICY IF EXISTS "access_requests_select_own" ON access_requests;
CREATE POLICY "access_requests_select_own" ON access_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Заявитель создаёт заявку только от своего имени
DROP POLICY IF EXISTS "access_requests_insert_own" ON access_requests;
CREATE POLICY "access_requests_insert_own" ON access_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Заявитель может отменить (удалить) свою заявку
DROP POLICY IF EXISTS "access_requests_delete_own" ON access_requests;
CREATE POLICY "access_requests_delete_own" ON access_requests
  FOR DELETE
  USING (user_id = auth.uid());

-- Админ видит все заявки
DROP POLICY IF EXISTS "access_requests_select_admin" ON access_requests;
CREATE POLICY "access_requests_select_admin" ON access_requests
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

-- Админ обрабатывает заявки (одобрение/отклонение → UPDATE status)
DROP POLICY IF EXISTS "access_requests_update_admin" ON access_requests;
CREATE POLICY "access_requests_update_admin" ON access_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

-- Админ может удалить любую заявку
DROP POLICY IF EXISTS "access_requests_delete_admin" ON access_requests;
CREATE POLICY "access_requests_delete_admin" ON access_requests
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin')
  );

-- ─── Диагностика: посмотреть итоговые политики ──────────────────────────────
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'access_requests';
