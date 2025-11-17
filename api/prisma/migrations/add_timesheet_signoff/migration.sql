-- Create Timesheet model for weekly sign-offs
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "totalHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signedOffById" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Timesheet_tenantId_idx" ON "Timesheet"("tenantId");
CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");
CREATE INDEX "Timesheet_weekStartDate_idx" ON "Timesheet"("weekStartDate");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE UNIQUE INDEX "Timesheet_tenantId_userId_weekStartDate_key" ON "Timesheet"("tenantId", "userId", "weekStartDate");
