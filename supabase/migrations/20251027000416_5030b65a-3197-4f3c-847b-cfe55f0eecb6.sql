-- Drop and recreate the teams INSERT policy with explicit type casting
DROP POLICY IF EXISTS "team_owner_can_insert" ON public.teams;

CREATE POLICY "team_owner_can_insert"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = coach_id);

-- Also ensure RLS is enabled
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;