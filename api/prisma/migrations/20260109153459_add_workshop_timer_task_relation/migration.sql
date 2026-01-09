-- Check if column exists and add if it doesn't
ALTER TABLE "WorkshopTimer"
ADD COLUMN IF NOT EXISTS "taskId" TEXT;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'WorkshopTimer' AND constraint_name = 'WorkshopTimer_taskId_fkey'
    ) THEN
        ALTER TABLE "WorkshopTimer" 
        ADD CONSTRAINT "WorkshopTimer_taskId_fkey" 
        FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
