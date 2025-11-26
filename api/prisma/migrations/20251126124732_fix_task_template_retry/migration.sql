-- This migration resolves the failed 20251126122031_add_task_template migration
-- It creates the types and tables if they don't exist

-- Mark the old migration as rolled back if it's still marked as failed
DO $$
BEGIN
    UPDATE _prisma_migrations 
    SET rolled_back_at = NOW(), 
        finished_at = NULL 
    WHERE migration_name = '20251126122031_add_task_template' 
      AND finished_at IS NULL 
      AND started_at IS NOT NULL;
END $$;

-- Create missing enum types (idempotent)
DO $$ BEGIN
    CREATE TYPE "TaskType" AS ENUM ('MANUAL', 'SCHEDULED', 'FORM', 'CHECKLIST', 'APPROVAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable TaskTemplate (idempotent)
CREATE TABLE IF NOT EXISTS "TaskTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taskType" "TaskType" NOT NULL,
    "defaultTitle" TEXT NOT NULL,
    "defaultDescription" TEXT,
    "defaultPriority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "relatedType" "RelatedType",
    "recurrencePattern" "RecurrencePattern",
    "recurrenceInterval" INTEGER DEFAULT 1,
    "formSchema" JSONB,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "checklistItems" JSONB,
    "defaultAssigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable FormTemplate (idempotent)
CREATE TABLE IF NOT EXISTS "FormTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "formSchema" JSONB NOT NULL,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "TaskTemplate_tenantId_isActive_idx" ON "TaskTemplate"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "TaskTemplate_tenantId_taskType_idx" ON "TaskTemplate"("tenantId", "taskType");
CREATE INDEX IF NOT EXISTS "FormTemplate_tenantId_isActive_idx" ON "FormTemplate"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "FormTemplate_tenantId_category_idx" ON "FormTemplate"("tenantId", "category");

-- AddForeignKey (check if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TaskTemplate_tenantId_fkey'
    ) THEN
        ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'FormTemplate_tenantId_fkey'
    ) THEN
        ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
