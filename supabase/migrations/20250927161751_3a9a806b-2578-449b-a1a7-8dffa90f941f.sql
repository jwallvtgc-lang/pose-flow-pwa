-- Update profiles table to support imperial measurements and track consecutive days
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS height_cm,
DROP COLUMN IF EXISTS weight_kg,
ADD COLUMN IF NOT EXISTS height_feet integer,
ADD COLUMN IF NOT EXISTS height_inches integer,
ADD COLUMN IF NOT EXISTS weight_lbs integer,
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_session_date date;

-- Add a function to update current streak
CREATE OR REPLACE FUNCTION public.update_user_streak(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    last_date date;
    today_date date := CURRENT_DATE;
    current_streak_count integer := 0;
BEGIN
    -- Get the user's last session date and current streak
    SELECT last_session_date, current_streak
    INTO last_date, current_streak_count
    FROM profiles
    WHERE id = user_id_param;
    
    -- If no last session date, this is the first session
    IF last_date IS NULL THEN
        current_streak_count := 1;
    -- If last session was yesterday, increment streak
    ELSIF last_date = today_date - INTERVAL '1 day' THEN
        current_streak_count := current_streak_count + 1;
    -- If last session was today, don't change streak
    ELSIF last_date = today_date THEN
        -- Do nothing, streak remains the same
        RETURN;
    -- If last session was more than 1 day ago, reset streak
    ELSE
        current_streak_count := 1;
    END IF;
    
    -- Update the profile with new streak and session date
    UPDATE profiles
    SET 
        current_streak = current_streak_count,
        last_session_date = today_date
    WHERE id = user_id_param;
END;
$$;