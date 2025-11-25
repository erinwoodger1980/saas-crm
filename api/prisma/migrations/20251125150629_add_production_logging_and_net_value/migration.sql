-- AlterTable
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "netValue" DECIMAL(65,30);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FireDoorProductionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "previousPercent" INTEGER NOT NULL,
    "addedPercent" INTEGER NOT NULL,
    "newPercent" INTEGER NOT NULL,
    "loggedBy" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "FireDoorProductionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FireDoorProductionLog_tenantId_projectId_idx" ON "FireDoorProductionLog"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FireDoorProductionLog_tenantId_loggedAt_idx" ON "FireDoorProductionLog"("tenantId", "loggedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FireDoorProductionLog_projectId_process_idx" ON "FireDoorProductionLog"("projectId", "process");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FireDoorProductionLog_tenantId_fkey'
    ) THEN
        ALTER TABLE "FireDoorProductionLog" ADD CONSTRAINT "FireDoorProductionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FireDoorProductionLog_projectId_fkey'
    ) THEN
        ALTER TABLE "FireDoorProductionLog" ADD CONSTRAINT "FireDoorProductionLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FireDoorScheduleProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
