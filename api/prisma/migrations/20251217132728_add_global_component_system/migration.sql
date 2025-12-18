-- CreateEnum for BOM status
CREATE TYPE "BOMStatus" AS ENUM ('DRAFT', 'PENDING_ORDER', 'ORDERED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- Add new fields to Supplier table for component system
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "preferredForTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "contactInfo" JSONB;

-- ComponentLookup: Universal component lookup table
CREATE TABLE "ComponentLookup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "componentType" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'EA',
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentLookup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "ComponentLookup_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "ComponentLookup_tenantId_code_key" ON "ComponentLookup"("tenantId", "code");
CREATE INDEX "ComponentLookup_tenantId_idx" ON "ComponentLookup"("tenantId");
CREATE INDEX "ComponentLookup_componentType_idx" ON "ComponentLookup"("componentType");
CREATE INDEX "ComponentLookup_supplierId_idx" ON "ComponentLookup"("supplierId");

-- ProductTypeComponent: Defines which components appear for each product type
CREATE TABLE "ProductTypeComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "formulaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "formulaExpression" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypeComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ProductTypeComponent_tenantId_productType_componentType_key" ON "ProductTypeComponent"("tenantId", "productType", "componentType");
CREATE INDEX "ProductTypeComponent_tenantId_productType_idx" ON "ProductTypeComponent"("tenantId", "productType");

-- ComponentProfile: 3D profile data for components
CREATE TABLE "ComponentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentLookupId" TEXT NOT NULL UNIQUE,
    "profileType" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "geometry" JSONB,
    "materialProperties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentProfile_componentLookupId_fkey" FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE CASCADE
);

CREATE INDEX "ComponentProfile_profileType_idx" ON "ComponentProfile"("profileType");

-- Project: Universal project wrapper for any type of job
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "projectName" TEXT,
    "referenceNumber" TEXT,
    "fireDoorScheduleId" TEXT UNIQUE,
    "quoteId" TEXT UNIQUE,
    "opportunityId" TEXT UNIQUE,
    "status" TEXT,
    "startDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "Project_fireDoorScheduleId_fkey" FOREIGN KEY ("fireDoorScheduleId") REFERENCES "FireDoorScheduleProject"("id") ON DELETE SET NULL,
    CONSTRAINT "Project_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL,
    CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL
);

CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");
CREATE INDEX "Project_projectType_idx" ON "Project"("projectType");
CREATE INDEX "Project_fireDoorScheduleId_idx" ON "Project"("fireDoorScheduleId");
CREATE INDEX "Project_quoteId_idx" ON "Project"("quoteId");
CREATE INDEX "Project_opportunityId_idx" ON "Project"("opportunityId");

-- BOMLineItem: Bill of materials line items for any project
CREATE TABLE "BOMLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "componentLookupId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "status" "BOMStatus" NOT NULL DEFAULT 'DRAFT',
    "dateOrdered" TIMESTAMP(3),
    "dateReceived" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOMLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE,
    CONSTRAINT "BOMLineItem_componentLookupId_fkey" FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE RESTRICT,
    CONSTRAINT "BOMLineItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL
);

CREATE INDEX "BOMLineItem_projectId_idx" ON "BOMLineItem"("projectId");
CREATE INDEX "BOMLineItem_componentLookupId_idx" ON "BOMLineItem"("componentLookupId");
CREATE INDEX "BOMLineItem_status_idx" ON "BOMLineItem"("status");
CREATE INDEX "BOMLineItem_supplierId_idx" ON "BOMLineItem"("supplierId");

-- ComponentAttribute: dynamic attributes per component type (e.g., Timber, Finish)
CREATE TABLE "ComponentAttribute" (
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
        "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "ComponentAttribute"
    ADD CONSTRAINT "ComponentAttribute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "ComponentAttribute_tenant_component_attr_unique" ON "ComponentAttribute"("tenantId", "componentType", "attributeName");
CREATE INDEX "ComponentAttribute_tenant_component_idx" ON "ComponentAttribute"("tenantId", "componentType");

-- ComponentVariant: specific variant/specification with attribute values
CREATE TABLE "ComponentVariant" (
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
        "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "ComponentVariant"
    ADD CONSTRAINT "ComponentVariant_componentLookupId_fkey" FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE CASCADE;
ALTER TABLE "ComponentVariant"
    ADD CONSTRAINT "ComponentVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ComponentVariant"
    ADD CONSTRAINT "ComponentVariant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL;
ALTER TABLE "ComponentVariant"
    ADD CONSTRAINT "ComponentVariant_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ComponentAttribute"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "ComponentVariant_tenant_variantCode_unique" ON "ComponentVariant"("tenantId", "variantCode");
CREATE INDEX "ComponentVariant_componentLookupId_idx" ON "ComponentVariant"("componentLookupId");
CREATE INDEX "ComponentVariant_tenantId_idx" ON "ComponentVariant"("tenantId");
CREATE INDEX "ComponentVariant_supplierId_idx" ON "ComponentVariant"("supplierId");

-- BOMVariantLineItem: BOM line items referencing specific variants
CREATE TABLE "BOMVariantLineItem" (
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
        "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "BOMVariantLineItem"
    ADD CONSTRAINT "BOMVariantLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "BOMVariantLineItem"
    ADD CONSTRAINT "BOMVariantLineItem_componentVariantId_fkey" FOREIGN KEY ("componentVariantId") REFERENCES "ComponentVariant"("id") ON DELETE RESTRICT;
ALTER TABLE "BOMVariantLineItem"
    ADD CONSTRAINT "BOMVariantLineItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL;

CREATE INDEX "BOMVariantLineItem_projectId_idx" ON "BOMVariantLineItem"("projectId");
CREATE INDEX "BOMVariantLineItem_componentVariantId_idx" ON "BOMVariantLineItem"("componentVariantId");
CREATE INDEX "BOMVariantLineItem_status_idx" ON "BOMVariantLineItem"("status");
