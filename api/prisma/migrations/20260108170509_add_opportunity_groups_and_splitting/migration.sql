-- AlterTable: Make leadId optional in Opportunity
ALTER TABLE "Opportunity" ALTER COLUMN "leadId" DROP NOT NULL;

-- AlterTable: Add groupId and parentOpportunityId to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "groupId" TEXT,
ADD COLUMN "parentOpportunityId" TEXT;

-- CreateTable: OpportunityGroup for batching projects
CREATE TABLE "OpportunityGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledStartDate" TIMESTAMP(3),
    "scheduledEndDate" TIMESTAMP(3),
    "budgetHours" DECIMAL(65,30),
    "status" TEXT DEFAULT 'PLANNED',

    CONSTRAINT "OpportunityGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add groupId to TimeEntry for group-level time tracking
ALTER TABLE "TimeEntry" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Opportunity_groupId_idx" ON "Opportunity"("groupId");

-- CreateIndex
CREATE INDEX "Opportunity_parentOpportunityId_idx" ON "Opportunity"("parentOpportunityId");

-- CreateIndex
CREATE INDEX "OpportunityGroup_tenantId_idx" ON "OpportunityGroup"("tenantId");

-- CreateIndex
CREATE INDEX "OpportunityGroup_tenantId_status_idx" ON "OpportunityGroup"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TimeEntry_groupId_idx" ON "TimeEntry"("groupId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OpportunityGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_parentOpportunityId_fkey" FOREIGN KEY ("parentOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityGroup" ADD CONSTRAINT "OpportunityGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OpportunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
