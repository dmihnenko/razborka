-- Таблица комментариев к заявкам СТО
CREATE TABLE IF NOT EXISTS appointment_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  sto_company_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_comments_appointment_id_idx ON appointment_comments(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_comments_sto_company_id_idx ON appointment_comments(sto_company_id);

ALTER TABLE appointment_comments ENABLE ROW LEVEL SECURITY;

-- Сотрудники СТО видят комментарии своей компании
CREATE POLICY "sto_members_read_comments" ON appointment_comments
  FOR SELECT
  USING (
    sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Сотрудники СТО могут добавлять комментарии от своего имени
CREATE POLICY "sto_members_insert_comments" ON appointment_comments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND sto_company_id IN (
      SELECT sto_company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Только владелец комментария может его удалить
CREATE POLICY "comment_owner_delete" ON appointment_comments
  FOR DELETE
  USING (user_id = auth.uid());
