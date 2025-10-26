-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "members_can_view_teams" ON public.teams;
DROP POLICY IF EXISTS "view_memberships_player_or_coach" ON public.team_members;

-- Create security definer function to check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
  );
$$;

-- Create security definer function to check if user is team coach
CREATE OR REPLACE FUNCTION public.is_team_coach(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND coach_id = _user_id
  );
$$;

-- Recreate the teams SELECT policy using the security definer function
CREATE POLICY "members_can_view_teams"
ON public.teams
FOR SELECT
USING (public.is_team_member(id, auth.uid()));

-- Recreate the team_members SELECT policy using the security definer function
CREATE POLICY "view_memberships_player_or_coach"
ON public.team_members
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  public.is_team_coach(team_id, auth.uid())
);