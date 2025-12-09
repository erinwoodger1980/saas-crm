-- Make TimeEntry.projectId nullable to support generic time tracking
-- This allows time entries for cleaning, admin, holiday, sick leave, etc. without a project

-- Make projectId nullable and update the foreign key
ALTER TABLE "TimeEntry" ALTER COLUMN "projectId" DROP NOT NULL;

-- Drop existing foreign key constraint
ALTER TABLE "TimeEntry" DROP CONSTRAINT IF EXISTS "TimeEntry_projectId_fkey";

-- Re-add foreign key with proper NULL handling
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Opportunity"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
