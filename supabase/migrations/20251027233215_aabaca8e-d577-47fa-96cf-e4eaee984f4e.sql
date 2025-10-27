-- Step 1: Add user_id column to swings table (nullable to support existing data)
ALTER TABLE public.swings 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Backfill user_id for swings that have session->athlete->user chain
UPDATE public.swings s
SET user_id = a.user_id
FROM public.sessions sess
JOIN public.athletes a ON sess.athlete_id = a.id
WHERE s.session_id = sess.id
AND s.user_id IS NULL
AND a.user_id IS NOT NULL;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_swings_user_id ON public.swings(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_swings_user_created ON public.swings(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Step 4: Drop the old permissive policies
DROP POLICY IF EXISTS "Swings are accessible" ON public.swings;
DROP POLICY IF EXISTS "Swing metrics are accessible" ON public.swing_metrics;

-- Step 5: Create user-specific RLS policies for swings
-- Users can only see their own swings
CREATE POLICY "Users can view their own swings"
ON public.swings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own swings"
ON public.swings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own swings"
ON public.swings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own swings"
ON public.swings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 6: Update swing_metrics RLS to be user-aware through swings
CREATE POLICY "Users can view their own swing metrics"
ON public.swing_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.swings
    WHERE swings.id = swing_metrics.swing_id
    AND swings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own swing metrics"
ON public.swing_metrics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.swings
    WHERE swings.id = swing_metrics.swing_id
    AND swings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own swing metrics"
ON public.swing_metrics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.swings
    WHERE swings.id = swing_metrics.swing_id
    AND swings.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own swing metrics"
ON public.swing_metrics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.swings
    WHERE swings.id = swing_metrics.swing_id
    AND swings.user_id = auth.uid()
  )
);