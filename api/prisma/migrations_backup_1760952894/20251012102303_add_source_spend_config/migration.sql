-- CreateTable
CREATE TABLE "LeadSourceSpend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amountGBP" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "LeadSourceSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scalable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadSourceSpend_tenantId_source_month_idx" ON "LeadSourceSpend"("tenantId", "source", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceConfig_tenantId_source_key" ON "LeadSourceConfig"("tenantId", "source");
