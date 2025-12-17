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
