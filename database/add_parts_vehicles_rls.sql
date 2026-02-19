-- Добавляем RLS политики для parts_vehicles если их нет

-- Политика для INSERT
CREATE POLICY "Parts company members can insert vehicles"
ON parts_vehicles FOR INSERT
TO authenticated
WITH CHECK (
  parts_company_id IN (
    SELECT parts_company_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Политика для SELECT
CREATE POLICY "Parts company members can view their vehicles"
ON parts_vehicles FOR SELECT
TO authenticated
USING (
  parts_company_id IN (
    SELECT parts_company_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Политика для UPDATE
CREATE POLICY "Parts company members can update their vehicles"
ON parts_vehicles FOR UPDATE
TO authenticated
USING (
  parts_company_id IN (
    SELECT parts_company_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Политика для DELETE
CREATE POLICY "Parts company members can delete their vehicles"
ON parts_vehicles FOR DELETE
TO authenticated
USING (
  parts_company_id IN (
    SELECT parts_company_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);
