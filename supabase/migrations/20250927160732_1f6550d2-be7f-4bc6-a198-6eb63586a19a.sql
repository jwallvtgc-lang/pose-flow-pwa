-- Add additional profile fields for user data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS height_cm integer,
ADD COLUMN IF NOT EXISTS weight_kg integer,
ADD COLUMN IF NOT EXISTS primary_position text,
ADD COLUMN IF NOT EXISTS current_team text;

-- Update the trigger function to handle additional profile data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;