-- Add client_request_id for idempotent saves
ALTER TABLE swings ADD COLUMN IF NOT EXISTS client_request_id UUID UNIQUE;

-- Create storage bucket for swing videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('swings', 'swings', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for swing videos
CREATE POLICY "Users can upload their own swing videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'swings');

CREATE POLICY "Users can view their own swing videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'swings');