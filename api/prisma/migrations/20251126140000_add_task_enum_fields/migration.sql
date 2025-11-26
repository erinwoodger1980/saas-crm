-- Add missing enum type fields to Task table
-- These fields were added to the schema but not migrated to the database

-- Create enum types if they don't exist (idempotent)
DO $$ BEGIN
  CREATE TYPE "TaskType" AS ENUM ('MANUAL', 'COMMUNICATION', 'FOLLOW_UP', 'SCHEDULED', 'FORM', 'CHECKLIST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunicationType" AS ENUM ('EMAIL', 'PHONE', 'MEETING', 'SMS', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add taskType with default MANUAL
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskType" "TaskType" DEFAULT 'MANUAL'::"TaskType";

-- Add communication fields (optional)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "communicationType" "CommunicationType";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "communicationChannel" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "communicationDirection" "CommunicationDirection";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "communicationNotes" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "emailMessageId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "followUpLogId" TEXT;

-- Add recurrence fields (optional)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "recurrencePattern" "RecurrencePattern";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "recurrenceInterval" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "nextDueAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastCompletedAt" TIMESTAMP(3);

-- Add template reference
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

-- Add auto-completion tracking
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "autoCompleted" BOOLEAN DEFAULT false;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completedBy" TEXT;

-- Add form fields (optional)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "formSchema" JSONB;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "formSubmissions" JSONB;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "requiresSignature" BOOLEAN DEFAULT false;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "signedBy" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

-- Add checklist fields (optional)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "checklistItems" JSONB;

-- Add foreign key for templateId if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Task_templateId_fkey'
  ) THEN
    ALTER TABLE "Task" ADD CONSTRAINT "Task_templateId_fkey" 
      FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "Task_emailMessageId_idx" ON "Task"("emailMessageId");
CREATE INDEX IF NOT EXISTS "Task_followUpLogId_idx" ON "Task"("followUpLogId");
CREATE INDEX IF NOT EXISTS "Task_tenantId_templateId_idx" ON "Task"("tenantId", "templateId");
CREATE INDEX IF NOT EXISTS "Task_tenantId_taskType_status_idx" ON "Task"("tenantId", "taskType", "status");
