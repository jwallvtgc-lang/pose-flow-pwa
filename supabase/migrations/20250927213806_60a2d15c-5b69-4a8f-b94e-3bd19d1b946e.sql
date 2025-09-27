-- Add drill_data field to store embedded drill information for fallback coaching
ALTER TABLE public.swings 
ADD COLUMN drill_data JSONB NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.swings.drill_data IS 'Stores drill information directly when drill_id is null (for fallback coaching)';