-- CreateTable for LookupTableRow (replaces JSON-based rows in LookupTable)
CREATE TABLE "LookupTableRow" (
    "id" TEXT NOT NULL,
    "lookupTableId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costPerUnit" DECIMAL(65,30) DEFAULT 0,
    "unitType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "markup" DECIMAL(65,30),
    "supplierId" TEXT,
    "supplierCode" TEXT,
    "leadTimeDays" INTEGER,
    "weight" DECIMAL(65,30),
    "weightUnit" TEXT,
    "texture" TEXT,
    "colorHex" TEXT,
    "materialType" TEXT,
    "materialProps" JSONB,
    "imageUrl" TEXT,
    "fireRated" BOOLEAN NOT NULL DEFAULT false,
    "fireRating" TEXT,
    "grade" TEXT,
    "finish" TEXT,
    "dimensions" JSONB,
    "customProps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable for ComponentTemplate
CREATE TABLE "ComponentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentCategory" TEXT NOT NULL,
    "description" TEXT,
    "requiredFields" TEXT[],
    "triggerFields" TEXT[],
    "lookupTableId" TEXT,
    "lookupFieldName" TEXT,
    "quantityFormula" TEXT,
    "quantityUnit" TEXT,
    "fieldMappings" JSONB NOT NULL,
    "defaultProps" JSONB,
    "activeWhen" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable LookupTable - rename 'name' to 'tableName', add 'category', remove 'columns' and 'rows' JSON
ALTER TABLE "LookupTable" RENAME COLUMN "name" TO "tableName";
ALTER TABLE "LookupTable" ADD COLUMN "category" TEXT;
ALTER TABLE "LookupTable" DROP COLUMN IF EXISTS "columns";
ALTER TABLE "LookupTable" DROP COLUMN IF EXISTS "rows";

-- Add supplier relation to LookupTableRow
ALTER TABLE "LookupTableRow" ADD CONSTRAINT "LookupTableRow_lookupTableId_fkey" FOREIGN KEY ("lookupTableId") REFERENCES "LookupTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LookupTableRow" ADD CONSTRAINT "LookupTableRow_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add tenant relation to ComponentTemplate
ALTER TABLE "ComponentTemplate" ADD CONSTRAINT "ComponentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComponentTemplate" ADD CONSTRAINT "ComponentTemplate_lookupTableId_fkey" FOREIGN KEY ("lookupTableId") REFERENCES "LookupTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "LookupTableRow_lookupTableId_value_key" ON "LookupTableRow"("lookupTableId", "value");
CREATE INDEX "LookupTableRow_lookupTableId_isActive_sortOrder_idx" ON "LookupTableRow"("lookupTableId", "isActive", "sortOrder");
CREATE INDEX "LookupTableRow_lookupTableId_value_idx" ON "LookupTableRow"("lookupTableId", "value");

CREATE UNIQUE INDEX "ComponentTemplate_tenantId_name_key" ON "ComponentTemplate"("tenantId", "name");
CREATE INDEX "ComponentTemplate_tenantId_isActive_idx" ON "ComponentTemplate"("tenantId", "isActive");
CREATE INDEX "ComponentTemplate_tenantId_componentCategory_idx" ON "ComponentTemplate"("tenantId", "componentCategory");

-- Update existing unique constraint on LookupTable
DROP INDEX IF EXISTS "LookupTable_tenantId_name_key";
CREATE UNIQUE INDEX "LookupTable_tenantId_tableName_key" ON "LookupTable"("tenantId", "tableName");

-- Add index for category
CREATE INDEX "LookupTable_tenantId_category_idx" ON "LookupTable"("tenantId", "category");
