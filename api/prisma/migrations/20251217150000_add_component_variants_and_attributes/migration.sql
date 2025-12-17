-- Component Variants and Attributes System
-- Handles dynamic component specifications like timber types, calculated dimensions, and variant-specific pricing

-- ComponentAttribute: Defines dynamic attributes for component types (e.g., timber options for lipping)
CREATE TABLE IF NOT EXISTS "ComponentAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "attributeName" TEXT NOT NULL,
    "attributeType" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "calculationFormula" TEXT,
    "calculationUnit" TEXT,
    "affectsPrice" BOOLEAN NOT NULL DEFAULT false,
    "affectsBOM" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "ComponentAttribute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComponentAttribute_tenantId_componentType_attributeName_key" 
    ON "ComponentAttribute"("tenantId", "componentType", "attributeName");
CREATE INDEX IF NOT EXISTS "ComponentAttribute_tenantId_componentType_idx" 
    ON "ComponentAttribute"("tenantId", "componentType");

-- ComponentVariant: Specific variants of components with selected attribute values
CREATE TABLE IF NOT EXISTS "ComponentVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentLookupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "attributeValues" JSONB NOT NULL,
    "dimensionFormulas" JSONB,
    "priceModifier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION,
    "supplierId" TEXT,
    "supplierSKU" TEXT,
    "leadTimeDays" INTEGER,
    "minimumOrderQty" DOUBLE PRECISION,
    "specifications" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStocked" BOOLEAN NOT NULL DEFAULT false,
    "stockLevel" DOUBLE PRECISION,
    "attributeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "ComponentVariant_componentLookupId_fkey" FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE CASCADE,
    CONSTRAINT "ComponentVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "ComponentVariant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL,
    CONSTRAINT "ComponentVariant_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ComponentAttribute"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComponentVariant_tenantId_variantCode_key" 
    ON "ComponentVariant"("tenantId", "variantCode");
CREATE INDEX IF NOT EXISTS "ComponentVariant_componentLookupId_idx" 
    ON "ComponentVariant"("componentLookupId");
CREATE INDEX IF NOT EXISTS "ComponentVariant_tenantId_idx" 
    ON "ComponentVariant"("tenantId");
CREATE INDEX IF NOT EXISTS "ComponentVariant_supplierId_idx" 
    ON "ComponentVariant"("supplierId");

-- BOMVariantLineItem: Enhanced BOM line items that reference specific component variants
CREATE TABLE IF NOT EXISTS "BOMVariantLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "componentVariantId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "calculatedDimensions" JSONB,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "supplierId" TEXT,
    "status" "BOMStatus" NOT NULL DEFAULT 'DRAFT',
    "dateOrdered" TIMESTAMP(3),
    "dateReceived" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "BOMVariantLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE,
    CONSTRAINT "BOMVariantLineItem_componentVariantId_fkey" FOREIGN KEY ("componentVariantId") REFERENCES "ComponentVariant"("id") ON DELETE RESTRICT,
    CONSTRAINT "BOMVariantLineItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "BOMVariantLineItem_projectId_idx" 
    ON "BOMVariantLineItem"("projectId");
CREATE INDEX IF NOT EXISTS "BOMVariantLineItem_componentVariantId_idx" 
    ON "BOMVariantLineItem"("componentVariantId");
CREATE INDEX IF NOT EXISTS "BOMVariantLineItem_status_idx" 
    ON "BOMVariantLineItem"("status");
