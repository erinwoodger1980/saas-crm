-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkshopTimer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "process" TEXT NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopTimer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkshopTimer_tenantId_userId_idx" ON "WorkshopTimer"("tenantId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkshopTimer_projectId_idx" ON "WorkshopTimer"("projectId");

-- AddForeignKey
ALTER TABLE "WorkshopTimer" ADD CONSTRAINT "WorkshopTimer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTimer" ADD CONSTRAINT "WorkshopTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTimer" ADD CONSTRAINT "WorkshopTimer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
