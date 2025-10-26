-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Coaches can create teams" ON public.teams;
DROP POLICY IF EXISTS "Coaches can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Coaches can delete their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can join teams" ON public.team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON public.team_members;
DROP POLICY IF EXISTS "Coaches can manage team members" ON public.team_members;

-- Drop the security definer functions we created earlier
DROP FUNCTION IF EXISTS public.is_team_coach(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_team_ids(uuid);

-- TEAMS POLICIES (non-recursive)
CREATE POLICY "team_owner_can_insert"
ON public.teams
FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "members_can_view_teams"
ON public.teams
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = teams.id
    AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "coach_can_update_team"
ON public.teams
FOR UPDATE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "coach_can_delete_team"
ON public.teams
FOR DELETE
USING (auth.uid() = coach_id);

-- TEAM MEMBERS POLICIES (non-recursive)
CREATE POLICY "user_can_join_team"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_can_view_own_memberships"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "coach_can_view_roster"
ON public.team_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.coach_id = auth.uid()
  )
);

CREATE POLICY "user_can_leave_team"
ON public.team_members
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "coach_can_manage_roster"
ON public.team_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.coach_id = auth.uid()
  )
);