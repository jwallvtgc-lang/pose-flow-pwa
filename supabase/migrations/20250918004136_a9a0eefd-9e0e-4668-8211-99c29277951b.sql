-- Fix security definer view issue by removing the view
-- The view was flagged as a security risk, so we'll remove it
DROP VIEW IF EXISTS public.public_profiles;

-- The profiles table is now properly secured with the policy:
-- "Users can view their own profile" - only allowing users to see their own data
-- This protects email addresses and all other personal information

-- Verify our current security policies are correct:
-- 1. Users can only SELECT their own profile data
-- 2. Users can only INSERT their own profile data  
-- 3. Users can only UPDATE their own profile data
-- 4. No public access to sensitive email addresses or personal information