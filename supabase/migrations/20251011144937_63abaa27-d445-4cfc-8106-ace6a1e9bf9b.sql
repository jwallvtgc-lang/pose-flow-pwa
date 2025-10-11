-- Add pose_data column to swings table to store keypoints for overlay visualization
ALTER TABLE public.swings ADD COLUMN IF NOT EXISTS pose_data JSONB;