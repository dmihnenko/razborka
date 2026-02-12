-- Миграция для поддержки множественных ролей

-- Создание таблицы связи пользователей и ролей (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Добавляем колонку is_primary, если таблица уже существовала
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Миграция существующих данных из user_profiles.role_id в user_roles
-- Существующая роль становится основной (is_primary = true)
INSERT INTO user_roles (user_id, role_id, is_primary)
SELECT id, role_id, true
FROM user_profiles
WHERE role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Включение RLS для новой таблицы
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Политики доступа для user_roles
DROP POLICY IF EXISTS "Allow authenticated users to read user_roles" ON user_roles;
CREATE POLICY "Allow authenticated users to read user_roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage user_roles" ON user_roles;
CREATE POLICY "Allow authenticated users to manage user_roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Комментарии
COMMENT ON TABLE user_roles IS 'Связь пользователей и ролей (один пользователь может иметь несколько ролей)';
COMMENT ON COLUMN user_roles.user_id IS 'ID пользователя';
COMMENT ON COLUMN user_roles.role_id IS 'ID роли';
COMMENT ON COLUMN user_roles.is_primary IS 'Основная роль (используется для роутинга при логине)';

-- Примечание: поле role_id в user_profiles оставляем для обратной совместимости
-- Можно будет удалить позже после полной миграции
COMMENT ON COLUMN user_profiles.role_id IS 'Устаревшее поле, используйте таблицу user_roles';
