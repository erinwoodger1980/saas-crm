-- Add holiday allowance to users
ALTER TABLE "User" ADD COLUMN "holidayAllowance" INTEGER DEFAULT 20;

-- Create holiday request table
CREATE TABLE "HolidayRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HolidayRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HolidayRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes
CREATE INDEX "HolidayRequest_tenantId_userId_idx" ON "HolidayRequest"("tenantId", "userId");
CREATE INDEX "HolidayRequest_tenantId_status_idx" ON "HolidayRequest"("tenantId", "status");
CREATE INDEX "HolidayRequest_userId_status_idx" ON "HolidayRequest"("userId", "status");
