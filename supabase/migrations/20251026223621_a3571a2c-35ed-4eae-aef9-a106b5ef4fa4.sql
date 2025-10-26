-- Drop the problematic policy
DROP POLICY IF EXISTS "Coaches can manage team members" ON public.team_members;

-- Create a security definer function to check if user is a team coach
CREATE OR REPLACE FUNCTION public.is_team_coach(team_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = team_id_param
      AND coach_id = user_id_param
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Coaches can manage team members"
  ON public.team_members FOR ALL
  USING (public.is_team_coach(team_id, auth.uid()));