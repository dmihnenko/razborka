-- ============================================================================
-- Fix parts_categories: add missing columns for templates and filtering
-- Run this in Supabase SQL editor
-- ============================================================================

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'global'
    CHECK (template_type IN ('global', 'brand', 'brand_model'));

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS model VARCHAR(100);

ALTER TABLE parts_categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Index for template lookups
CREATE INDEX IF NOT EXISTS idx_parts_categories_template
  ON parts_categories(is_template, template_type, brand);

CREATE INDEX IF NOT EXISTS idx_parts_categories_active
  ON parts_categories(parts_company_id, is_active);
