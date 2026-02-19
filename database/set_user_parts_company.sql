-- Check current user's parts_company_id and potentially set it for testing

-- 1. Check current user's profile
SELECT 
    id,
    username,
    parts_company_id,
    sto_company_id
FROM user_profiles
WHERE id = auth.uid();

-- 2. Check available parts companies
SELECT 
    id,
    name
FROM parts_companies
ORDER BY created_at DESC;

-- 3. Assign current user to first available parts company (for testing)
UPDATE user_profiles 
SET parts_company_id = (SELECT id FROM parts_companies LIMIT 1)
WHERE id = auth.uid()
RETURNING id, username, parts_company_id;
