-- Fix critical security vulnerability in athletes table
-- Add user_id column to link athletes to authenticated users
ALTER TABLE public.athletes 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the insecure public policy
DROP POLICY "Athletes are accessible" ON public.athletes;

-- Create secure RLS policies

-- Policy 1: Users can view their own athlete records
CREATE POLICY "Users can view their own athletes" 
ON public.athletes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own athlete records
CREATE POLICY "Users can insert their own athletes" 
ON public.athletes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own athlete records
CREATE POLICY "Users can update their own athletes" 
ON public.athletes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy 4: Users can delete their own athlete records
CREATE POLICY "Users can delete their own athletes" 
ON public.athletes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance on user_id lookups
CREATE INDEX idx_athletes_user_id ON public.athletes(user_id);

-- Update existing athlete records to have a user_id (for demo purposes, set to null)
-- In production, you'd need to properly assign these to actual users
UPDATE public.athletes SET user_id = NULL WHERE user_id IS NULL;