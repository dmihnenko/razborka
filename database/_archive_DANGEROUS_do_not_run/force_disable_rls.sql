-- Force disable RLS and verify status

-- 1. Disable RLS
ALTER TABLE parts_vehicles DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies (just to be safe)
DROP POLICY IF EXISTS "Parts company members can view their vehicles" ON parts_vehicles;
DROP POLICY IF EXISTS "Parts company members can insert vehicles" ON parts_vehicles;
DROP POLICY IF EXISTS "Parts company members can update vehicles" ON parts_vehicles;
DROP POLICY IF EXISTS "Parts company members can delete vehicles" ON parts_vehicles;

-- 3. Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS_Enabled"
FROM pg_tables
WHERE tablename = 'parts_vehicles';

-- 4. Check remaining policies (should be empty)
SELECT 
    policyname,
    cmd as "Command"
FROM pg_policies
WHERE tablename = 'parts_vehicles';
