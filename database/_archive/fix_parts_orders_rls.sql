-- ============================================================================
-- Check & fix RLS policies on parts_orders
-- Run in Supabase SQL editor to diagnose 400 on PATCH parts_orders
-- ============================================================================

-- Step 1: see what policies currently exist
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'parts_orders'
ORDER BY cmd, policyname;

-- Step 2: check if RLS is enabled at all
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'parts_orders';

-- ============================================================================
-- If UPDATE policy is missing — run the block below
-- ============================================================================

-- Allow anon (app uses anon key) to update orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'parts_orders' AND cmd = 'UPDATE'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "parts_orders_update_anon"
        ON parts_orders FOR UPDATE
        TO anon
        USING (true)
        WITH CHECK (true);
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "parts_orders_update_authenticated"
        ON parts_orders FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    $pol$;

    RAISE NOTICE 'UPDATE policies created';
  ELSE
    RAISE NOTICE 'UPDATE policy already exists';
  END IF;
END $$;
