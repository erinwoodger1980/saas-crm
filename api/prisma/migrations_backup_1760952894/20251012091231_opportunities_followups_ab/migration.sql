-- CreateTable
CREATE TABLE "FollowUpLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened" BOOLEAN,
    "replied" BOOLEAN,
    "converted" BOOLEAN,
    "delayDays" INTEGER,

    CONSTRAINT "FollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "scalable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSourceCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpLog_tenantId_leadId_sentAt_idx" ON "FollowUpLog"("tenantId", "leadId", "sentAt");

-- CreateIndex
CREATE INDEX "LeadSourceCost_tenantId_source_month_idx" ON "LeadSourceCost"("tenantId", "source", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceCost_tenantId_source_month_key" ON "LeadSourceCost"("tenantId", "source", "month");
