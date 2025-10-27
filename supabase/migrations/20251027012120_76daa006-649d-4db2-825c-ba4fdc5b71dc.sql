-- Create team_messages table
CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  sender_role TEXT CHECK (sender_role IN ('coach', 'player')),
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- SELECT policy: members can view messages for their teams
CREATE POLICY "members_can_view_messages"
ON public.team_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = team_messages.team_id
    AND tm.user_id = auth.uid()
  )
);

-- INSERT policy: members can send messages to their teams
CREATE POLICY "members_can_send_messages"
ON public.team_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = team_messages.team_id
    AND tm.user_id = auth.uid()
  )
  AND team_messages.sender_id = auth.uid()
);

-- Create index for better query performance
CREATE INDEX idx_team_messages_team_id ON public.team_messages(team_id);
CREATE INDEX idx_team_messages_created_at ON public.team_messages(created_at);
CREATE INDEX idx_team_messages_pinned ON public.team_messages(pinned) WHERE pinned = true;