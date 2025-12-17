-- CreateTable
CREATE TABLE "LippingLookup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "doorsetType" TEXT NOT NULL,
    "topMm" INTEGER,
    "bottomMm" INTEGER,
    "hingeMm" INTEGER,
    "lockMm" INTEGER,
    "safeHingeMm" INTEGER,
    "daExposedMm" INTEGER,
    "trimMm" INTEGER,
    "postformedMm" INTEGER,
    "extrasMm" INTEGER,
    "commentsForNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LippingLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LippingLookup_tenantId_isActive_idx" ON "LippingLookup"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LippingLookup_tenantId_doorsetType_key" ON "LippingLookup"("tenantId", "doorsetType");

-- AddForeignKey
ALTER TABLE "LippingLookup" ADD CONSTRAINT "LippingLookup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
