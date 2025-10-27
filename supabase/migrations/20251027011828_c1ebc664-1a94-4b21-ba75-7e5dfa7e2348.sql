-- Create assigned_drills table
CREATE TABLE public.assigned_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID,
  drill_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  due_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.assigned_drills ENABLE ROW LEVEL SECURITY;

-- INSERT policy: Coaches can assign drills to their team members
CREATE POLICY "Coaches can assign drills to their team"
ON public.assigned_drills
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = assigned_drills.team_id
    AND t.coach_id = auth.uid()
  )
);

-- SELECT policy: Players can see drills assigned to them or their team
CREATE POLICY "Players can view their assigned drills"
ON public.assigned_drills
FOR SELECT
TO authenticated
USING (
  -- Drills assigned directly to the player
  assigned_drills.player_id = auth.uid()
  OR
  -- Drills assigned to a team the player is on
  (
    assigned_drills.player_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = assigned_drills.team_id
      AND tm.user_id = auth.uid()
    )
  )
);

-- SELECT policy: Coaches can view drills they assigned
CREATE POLICY "Coaches can view drills they assigned"
ON public.assigned_drills
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = assigned_drills.team_id
    AND t.coach_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_assigned_drills_player_id ON public.assigned_drills(player_id);
CREATE INDEX idx_assigned_drills_team_id ON public.assigned_drills(team_id);
CREATE INDEX idx_assigned_drills_created_at ON public.assigned_drills(created_at DESC);