-- Workshop Timber Tracking (running metres, deliveries, usage logs)

-- CreateTable
CREATE TABLE IF NOT EXISTS "TimberDelivery" (
	"id" TEXT NOT NULL,
	"tenantId" TEXT NOT NULL,
	"supplierId" TEXT,
	"reference" TEXT,
	"deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"notes" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "TimberDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TimberDeliveryLine" (
	"id" TEXT NOT NULL,
	"tenantId" TEXT NOT NULL,
	"deliveryId" TEXT NOT NULL,
	"materialId" TEXT NOT NULL,
	"lengthMmTotal" INTEGER NOT NULL,
	"totalCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
	"currency" TEXT NOT NULL DEFAULT 'GBP',
	"unitCostPerMeter" DECIMAL(65,30) NOT NULL DEFAULT 0,
	"notes" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "TimberDeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TimberUsageLog" (
	"id" TEXT NOT NULL,
	"tenantId" TEXT NOT NULL,
	"opportunityId" TEXT NOT NULL,
	"materialId" TEXT NOT NULL,
	"userId" TEXT,
	"lengthMm" INTEGER NOT NULL,
	"quantity" INTEGER NOT NULL DEFAULT 1,
	"usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"notes" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "TimberUsageLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "TimberDelivery_tenantId_idx" ON "TimberDelivery"("tenantId");
CREATE INDEX IF NOT EXISTS "TimberDelivery_tenantId_deliveredAt_idx" ON "TimberDelivery"("tenantId", "deliveredAt");
CREATE INDEX IF NOT EXISTS "TimberDelivery_supplierId_idx" ON "TimberDelivery"("supplierId");

CREATE INDEX IF NOT EXISTS "TimberDeliveryLine_tenantId_idx" ON "TimberDeliveryLine"("tenantId");
CREATE INDEX IF NOT EXISTS "TimberDeliveryLine_deliveryId_idx" ON "TimberDeliveryLine"("deliveryId");
CREATE INDEX IF NOT EXISTS "TimberDeliveryLine_materialId_idx" ON "TimberDeliveryLine"("materialId");
CREATE INDEX IF NOT EXISTS "TimberDeliveryLine_tenantId_materialId_createdAt_idx" ON "TimberDeliveryLine"("tenantId", "materialId", "createdAt");

CREATE INDEX IF NOT EXISTS "TimberUsageLog_tenantId_idx" ON "TimberUsageLog"("tenantId");
CREATE INDEX IF NOT EXISTS "TimberUsageLog_tenantId_opportunityId_idx" ON "TimberUsageLog"("tenantId", "opportunityId");
CREATE INDEX IF NOT EXISTS "TimberUsageLog_tenantId_materialId_idx" ON "TimberUsageLog"("tenantId", "materialId");
CREATE INDEX IF NOT EXISTS "TimberUsageLog_tenantId_usedAt_idx" ON "TimberUsageLog"("tenantId", "usedAt");

-- Foreign Keys
DO $$ BEGIN
	ALTER TABLE "TimberDelivery" ADD CONSTRAINT "TimberDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberDelivery" ADD CONSTRAINT "TimberDelivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberDeliveryLine" ADD CONSTRAINT "TimberDeliveryLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberDeliveryLine" ADD CONSTRAINT "TimberDeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "TimberDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberDeliveryLine" ADD CONSTRAINT "TimberDeliveryLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberUsageLog" ADD CONSTRAINT "TimberUsageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberUsageLog" ADD CONSTRAINT "TimberUsageLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberUsageLog" ADD CONSTRAINT "TimberUsageLog_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "TimberUsageLog" ADD CONSTRAINT "TimberUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
