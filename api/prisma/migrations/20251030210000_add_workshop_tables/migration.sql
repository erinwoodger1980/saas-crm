-- Create WorkshopProcess enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkshopProcess') THEN
        CREATE TYPE "WorkshopProcess" AS ENUM (
            'MACHINING',
            'ASSEMBLY',
            'SANDING',
            'SPRAYING',
            'FINAL_ASSEMBLY',
            'GLAZING',
            'IRONMONGERY',
            'INSTALLATION'
        );
    END IF;
END$$;

-- Create ProcessPlan table
CREATE TABLE IF NOT EXISTS "ProcessPlan" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "process" "WorkshopProcess" NOT NULL,
    "plannedWeek" INTEGER NOT NULL,
    "assignedUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ProcessPlan_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessPlan_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessPlan_assignee_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- Unique constraint (tenantId, projectId, process)
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessPlan_tenant_project_process_key"
ON "ProcessPlan" ("tenantId", "projectId", "process");

-- Secondary index (tenantId, assignedUserId)
CREATE INDEX IF NOT EXISTS "ProcessPlan_tenant_assignee_idx"
ON "ProcessPlan" ("tenantId", "assignedUserId");

-- Create TimeEntry table
CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "process" "WorkshopProcess" NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMPTZ NOT NULL,
    "hours" NUMERIC NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "TimeEntry_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- Indices for TimeEntry
CREATE INDEX IF NOT EXISTS "TimeEntry_tenant_project_process_idx"
ON "TimeEntry" ("tenantId", "projectId", "process");

CREATE INDEX IF NOT EXISTS "TimeEntry_tenant_date_idx"
ON "TimeEntry" ("tenantId", "date");
