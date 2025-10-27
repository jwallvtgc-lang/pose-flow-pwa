-- Grant INSERT permission to authenticated users on teams table
GRANT INSERT ON public.teams TO authenticated;

-- Also grant SELECT for reading back the created team
GRANT SELECT ON public.teams TO authenticated;

-- Verify the policy is correct
DROP POLICY IF EXISTS "team_owner_can_insert" ON public.teams;

CREATE POLICY "team_owner_can_insert"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = coach_id);