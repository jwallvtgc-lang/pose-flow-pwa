-- Allow team members to view profiles of other members on their teams
CREATE POLICY "team_members_can_view_teammate_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.team_members tm1
    WHERE tm1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.team_members tm2
      WHERE tm2.user_id = profiles.id
      AND tm2.team_id = tm1.team_id
    )
  )
);