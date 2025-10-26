-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;

-- Create security definer function to check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(team_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = team_id_param
      AND user_id = user_id_param
  )
$$;

-- Create security definer function to get user's team IDs
CREATE OR REPLACE FUNCTION public.get_user_team_ids(user_id_param uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = user_id_param
$$;

-- Recreate teams policy using security definer function
CREATE POLICY "Users can view their teams"
  ON public.teams FOR SELECT
  USING (id IN (SELECT public.get_user_team_ids(auth.uid())));

-- Recreate team_members policy using security definer function
CREATE POLICY "Users can view team members"
  ON public.team_members FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));