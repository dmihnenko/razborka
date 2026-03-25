-- Global application settings table
-- Allows admin to set platform-wide configuration (e.g., design system)
-- All authenticated users can read; only admins can modify

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default design setting
INSERT INTO app_settings (key, value)
  VALUES ('design', 'classic')
  ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon) can read — needed for non-authenticated public pages
DROP POLICY IF EXISTS "app_settings_public_read" ON app_settings;
CREATE POLICY "app_settings_public_read"
  ON app_settings FOR SELECT
  USING (true);

-- Only platform admins can write
DROP POLICY IF EXISTS "app_settings_admin_write" ON app_settings;
CREATE POLICY "app_settings_admin_write"
  ON app_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'admin'
    )
  );

-- Enable realtime for this table (so all clients get live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
