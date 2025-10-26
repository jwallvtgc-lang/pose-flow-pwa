-- 1. Ensure tables exist
create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  coach_id uuid references auth.users(id),
  invite_code text unique,
  created_at timestamp default now()
);

create table if not exists public.team_members (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('coach','player')),
  joined_at timestamp default now()
);

-- 2. Turn off RLS so we can safely reset policies
alter table public.teams disable row level security;
alter table public.team_members disable row level security;

-- 3. Drop ALL existing policies on both tables
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('teams', 'team_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname,
      (SELECT tablename FROM pg_policies WHERE policyname = pol.policyname LIMIT 1)
    );
  END LOOP;
END $$;

-- Safety: run explicit drops too in case the loop didn't catch them
DROP POLICY IF EXISTS "team_owner_can_insert" ON public.teams;
DROP POLICY IF EXISTS "members_can_view_teams" ON public.teams;
DROP POLICY IF EXISTS "coach_can_update_team" ON public.teams;
DROP POLICY IF EXISTS "user_can_join_team" ON public.team_members;
DROP POLICY IF EXISTS "user_can_view_own_memberships" ON public.team_members;
DROP POLICY IF EXISTS "coach_can_view_roster" ON public.team_members;

-- 4. Turn RLS back on (clean slate, no policies active yet)
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- 5. Recreate ONLY the safe, non-recursive policies

-- TEAMS: INSERT (only the coach creating the team)
CREATE POLICY "team_owner_can_insert"
ON public.teams
FOR INSERT
WITH CHECK (auth.uid() = coach_id);

-- TEAMS: SELECT (only users who are members of that team)
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

-- TEAMS: UPDATE (only the coach can update)
CREATE POLICY "coach_can_update_team"
ON public.teams
FOR UPDATE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- TEAM_MEMBERS: INSERT (a user can only insert themselves)
CREATE POLICY "user_can_join_team"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- TEAM_MEMBERS: SELECT (a user can view their own memberships)
CREATE POLICY "user_can_view_own_memberships"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

-- TEAM_MEMBERS: SELECT for coaches (coach can view full roster)
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