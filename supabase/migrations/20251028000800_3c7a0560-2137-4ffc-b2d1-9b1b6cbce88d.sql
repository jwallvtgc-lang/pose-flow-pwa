-- Add status tracking to assigned_drills table
ALTER TABLE public.assigned_drills 
ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed'));

ALTER TABLE public.assigned_drills 
ADD COLUMN completed_at timestamp with time zone;

-- Add index for faster status queries
CREATE INDEX idx_assigned_drills_status ON public.assigned_drills(status);

-- Add comment for documentation
COMMENT ON COLUMN public.assigned_drills.status IS 'Status of the drill assignment: pending or completed';
COMMENT ON COLUMN public.assigned_drills.completed_at IS 'Timestamp when the assignment was marked as completed';