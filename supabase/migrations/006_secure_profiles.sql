-- 1. Add billing_start_date column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'billing_start_date') THEN
        ALTER TABLE profiles ADD COLUMN billing_start_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Revoke UPDATE permission from users on profiles table
-- Previous policy "Users can update own profile" allowed changing subscription_tier!
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 3. Ensure no new policy allows UPDATE for authenticated users
-- (unless we want to allow updating simple fields like 'full_name' in the future,
--  in which case we should use: WITH CHECK (true) AND USING (true) but specify columns in the GRANT or check changed columns in a trigger)

-- For now, purely backend updates for critical fields.
-- If user needs to update non-critical fields, we can add a specific policy later or a stored proc.
