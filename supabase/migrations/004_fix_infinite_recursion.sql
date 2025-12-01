-- Fix infinite recursion between recordings and live_shares policies

-- 1. Create a SECURITY DEFINER function to check recording ownership
-- This bypasses RLS on the recordings table, breaking the recursion cycle
CREATE OR REPLACE FUNCTION public.is_recording_owner(_recording_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM recordings
    WHERE id = _recording_id
    AND user_id = auth.uid()
  );
END;
$$;

-- 2. Drop the problematic policy on live_shares
DROP POLICY IF EXISTS "Users can manage shares for own recordings" ON live_shares;

-- 3. Re-create the policy using the new function
CREATE POLICY "Users can manage shares for own recordings"
  ON live_shares FOR ALL
  USING (is_recording_owner(recording_id));

-- 4. Ensure the function is accessible
GRANT EXECUTE ON FUNCTION public.is_recording_owner TO authenticated, anon;
