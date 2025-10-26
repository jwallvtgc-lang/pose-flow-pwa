-- STEP 1: DROP ALL EXISTING POLICIES on teams and team_members
DROP POLICY IF EXISTS "team_owner_can_insert" ON public.teams;
DROP POLICY IF EXISTS "members_can_view_teams" ON public.teams;
DROP POLICY IF EXISTS "coach_can_update_team" ON public.teams;
DROP POLICY IF EXISTS "coach_can_delete_team" ON public.teams;

DROP POLICY IF EXISTS "user_can_join_team" ON public.team_members;
DROP POLICY IF EXISTS "user_can_view_own_memberships" ON public.team_members;
DROP POLICY IF EXISTS "coach_can_view_roster" ON public.team_members;
DROP POLICY IF EXISTS "user_can_leave_team" ON public.team_members;
DROP POLICY IF EXISTS "coach_can_manage_roster" ON public.team_members;

-- STEP 2: ENSURE TABLES EXIST and RLS is enabled
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  coach_id uuid REFERENCES auth.users(id),
  invite_code text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('coach','player')),
  joined_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- STEP 3: CREATE ONLY SAFE NON-RECURSIVE POLICIES

-- TEAMS: allow insert if you are the coach creating it
CREATE POLICY "team_owner_can_insert"
ON public.teams
FOR INSERT
WITH CHECK (auth.uid() = coach_id);

-- TEAMS: allow select if you are in that team_members row for this team
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

-- TEAMS: allow update if you are the coach
CREATE POLICY "coach_can_update_team"
ON public.teams
FOR UPDATE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- TEAM_MEMBERS: allow inserting yourself into a team
CREATE POLICY "user_can_join_team"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- TEAM_MEMBERS: allow a user to view their own memberships
CREATE POLICY "user_can_view_own_memberships"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

-- TEAM_MEMBERS: allow a coach to view their whole roster
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