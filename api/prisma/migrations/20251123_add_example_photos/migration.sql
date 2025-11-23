-- Create ExamplePhoto table for photo gallery system
CREATE TABLE "ExamplePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productType" TEXT,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "thicknessMm" INTEGER,
    "timberSpecies" TEXT,
    "timberGrade" TEXT,
    "glassType" TEXT,
    "finishType" TEXT,
    "fireRating" TEXT,
    "priceGBP" DECIMAL,
    "priceDate" TIMESTAMP(3),
    "supplierName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "selectionCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign keys
ALTER TABLE "ExamplePhoto" ADD CONSTRAINT "ExamplePhoto_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamplePhoto" ADD CONSTRAINT "ExamplePhoto_uploadedById_fkey" 
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for efficient querying
CREATE INDEX "ExamplePhoto_tenantId_isActive_idx" ON "ExamplePhoto"("tenantId", "isActive");
CREATE INDEX "ExamplePhoto_tenantId_tags_idx" ON "ExamplePhoto"("tenantId", "tags");
CREATE INDEX "ExamplePhoto_tenantId_productType_idx" ON "ExamplePhoto"("tenantId", "productType");
CREATE INDEX "ExamplePhoto_displayOrder_idx" ON "ExamplePhoto"("displayOrder");
