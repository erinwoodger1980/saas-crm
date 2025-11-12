-- Add workshopColor column to User table for schedule display
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workshopColor" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "User"."workshopColor" IS 'Hex color code for displaying user in workshop schedule (e.g. #3b82f6)';
