-- Add WorkshopProcessDefinition and ProjectProcessAssignment tables (idempotent)
-- Also ensure Holiday table exists for the workshop module

-- WorkshopProcessDefinition
CREATE TABLE IF NOT EXISTS "WorkshopProcessDefinition" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "requiredByDefault" BOOLEAN NOT NULL DEFAULT true,
  "estimatedHours" DECIMAL(65,30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Unique and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopProcessDefinition_tenantId_code_key"
  ON "WorkshopProcessDefinition" ("tenantId", "code");
CREATE INDEX IF NOT EXISTS "WorkshopProcessDefinition_tenantId_sortOrder_idx"
  ON "WorkshopProcessDefinition" ("tenantId", "sortOrder");

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'WorkshopProcessDefinition_tenantId_fkey'
  ) THEN
    ALTER TABLE "WorkshopProcessDefinition"
      ADD CONSTRAINT "WorkshopProcessDefinition_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ProjectProcessAssignment
CREATE TABLE IF NOT EXISTS "ProjectProcessAssignment" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "processDefinitionId" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "assignedUserId" TEXT,
  "estimatedHours" DECIMAL(65,30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Uniques and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectProcessAssignment_opportunityId_processDefinitionId_key"
  ON "ProjectProcessAssignment" ("opportunityId", "processDefinitionId");
CREATE INDEX IF NOT EXISTS "ProjectProcessAssignment_tenantId_opportunityId_idx"
  ON "ProjectProcessAssignment" ("tenantId", "opportunityId");
CREATE INDEX IF NOT EXISTS "ProjectProcessAssignment_tenantId_assignedUserId_idx"
  ON "ProjectProcessAssignment" ("tenantId", "assignedUserId");

-- FKs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ProjectProcessAssignment_tenantId_fkey'
  ) THEN
    ALTER TABLE "ProjectProcessAssignment"
      ADD CONSTRAINT "ProjectProcessAssignment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ProjectProcessAssignment_opportunityId_fkey'
  ) THEN
    ALTER TABLE "ProjectProcessAssignment"
      ADD CONSTRAINT "ProjectProcessAssignment_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ProjectProcessAssignment_processDefinitionId_fkey'
  ) THEN
    ALTER TABLE "ProjectProcessAssignment"
      ADD CONSTRAINT "ProjectProcessAssignment_processDefinitionId_fkey"
      FOREIGN KEY ("processDefinitionId") REFERENCES "WorkshopProcessDefinition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ProjectProcessAssignment_assignedUserId_fkey'
  ) THEN
    ALTER TABLE "ProjectProcessAssignment"
      ADD CONSTRAINT "ProjectProcessAssignment_assignedUserId_fkey"
      FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Holiday table for workshop PTO
CREATE TABLE IF NOT EXISTS "Holiday" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Holiday_tenantId_idx" ON "Holiday" ("tenantId");
CREATE INDEX IF NOT EXISTS "Holiday_userId_idx" ON "Holiday" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Holiday_tenantId_fkey'
  ) THEN
    ALTER TABLE "Holiday"
      ADD CONSTRAINT "Holiday_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Holiday_userId_fkey'
  ) THEN
    ALTER TABLE "Holiday"
      ADD CONSTRAINT "Holiday_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
