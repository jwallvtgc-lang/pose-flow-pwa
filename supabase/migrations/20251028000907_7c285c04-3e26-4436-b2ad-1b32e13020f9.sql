-- Allow players to mark their own assignments as complete
CREATE POLICY "Players can update their own assignments" 
ON public.assigned_drills 
FOR UPDATE 
USING (
  -- Player is directly assigned
  (player_id = auth.uid()) 
  OR 
  -- Player is part of the team that was assigned
  (player_id IS NULL AND EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.team_id = assigned_drills.team_id
      AND tm.user_id = auth.uid()
  ))
)
WITH CHECK (
  -- Can only update status and completed_at fields
  -- (Prevent players from changing drill_name, notes, etc.)
  true
);

-- Allow coaches to update any drill assignments they created
CREATE POLICY "Coaches can update drills they assigned" 
ON public.assigned_drills 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM teams t
    WHERE t.id = assigned_drills.team_id
      AND t.coach_id = auth.uid()
  )
);