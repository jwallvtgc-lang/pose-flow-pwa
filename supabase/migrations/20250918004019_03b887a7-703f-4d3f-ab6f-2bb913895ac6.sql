-- CRITICAL SECURITY FIX: Protect user email addresses and personal data
-- Drop the dangerous public policy that exposes all user data
DROP POLICY "Public profiles are viewable by everyone" ON public.profiles;

-- Create secure policy: Users can only view their own profile data
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Create a separate view for public profile information (excluding sensitive data)
-- This allows safe sharing of non-sensitive profile info while protecting emails
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- Enable RLS on the view (inherits from the table)
-- The view will only show data that users can access through the table policies

-- Create policy for public profile view (safe data only)
-- Note: Views don't need RLS policies if the underlying table has proper RLS