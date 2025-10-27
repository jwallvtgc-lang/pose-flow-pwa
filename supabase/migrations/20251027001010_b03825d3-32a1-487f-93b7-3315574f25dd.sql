-- Temporarily drop the restrictive policy and create a more permissive one for testing
DROP POLICY IF EXISTS "team_owner_can_insert" ON public.teams;

-- Create a temporary policy that allows any authenticated user to insert
-- This will help us verify if the issue is with the policy logic or something else
CREATE POLICY "temp_authenticated_can_insert"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Log a comment to remind us this is temporary
COMMENT ON POLICY "temp_authenticated_can_insert" ON public.teams IS 'TEMPORARY: Allows any authenticated user to create teams for testing. Replace with proper coach_id check once working.';