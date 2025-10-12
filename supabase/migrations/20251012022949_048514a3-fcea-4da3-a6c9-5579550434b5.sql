-- Add video_url column to drills table (if it doesn't exist)
-- This will store the CDN URL of pre-generated AI drill videos

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drills' 
    AND column_name = 'video_url'
  ) THEN
    ALTER TABLE public.drills 
    ADD COLUMN video_url TEXT;
    
    COMMENT ON COLUMN public.drills.video_url IS 'URL to pre-generated AI video demonstration of the drill';
  END IF;
END $$;