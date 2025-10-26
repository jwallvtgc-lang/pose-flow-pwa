-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex')
);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('player', 'coach')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
-- Anyone can view teams they're a member of
CREATE POLICY "Users can view their teams"
  ON public.teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Coaches can insert their own teams
CREATE POLICY "Coaches can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- Coaches can update their own teams
CREATE POLICY "Coaches can update their teams"
  ON public.teams FOR UPDATE
  USING (coach_id = auth.uid());

-- Coaches can delete their own teams
CREATE POLICY "Coaches can delete their teams"
  ON public.teams FOR DELETE
  USING (coach_id = auth.uid());

-- RLS Policies for team_members
-- Users can view team members of teams they belong to
CREATE POLICY "Users can view team members"
  ON public.team_members FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- Users can join teams (insert themselves)
CREATE POLICY "Users can join teams"
  ON public.team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can leave teams (delete themselves)
CREATE POLICY "Users can leave teams"
  ON public.team_members FOR DELETE
  USING (user_id = auth.uid());

-- Coaches can manage their team members
CREATE POLICY "Coaches can manage team members"
  ON public.team_members FOR ALL
  USING (
    team_id IN (
      SELECT id FROM public.teams WHERE coach_id = auth.uid()
    )
  );