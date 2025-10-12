-- Add bat speed columns to swings table
ALTER TABLE public.swings
ADD COLUMN bat_speed_peak double precision,
ADD COLUMN bat_speed_avg double precision;

COMMENT ON COLUMN public.swings.bat_speed_peak IS 'Peak bat speed in MPH';
COMMENT ON COLUMN public.swings.bat_speed_avg IS 'Average bat speed in MPH during swing';