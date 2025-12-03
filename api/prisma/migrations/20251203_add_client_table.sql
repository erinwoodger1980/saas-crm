-- Migration: Add Client table and restructure Lead/Opportunity relationships
-- This creates a proper Client entity that can have multiple Leads and Opportunities

-- Step 1: Create the Client table
CREATE TABLE "Client" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "postcode" TEXT,
  "country" TEXT DEFAULT 'UK',
  "contactPerson" TEXT,
  "companyName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Step 2: Create indexes for performance
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE INDEX "Client_tenantId_name_idx" ON "Client"("tenantId", "name");
CREATE INDEX "Client_tenantId_email_idx" ON "Client"("tenantId", "email");
CREATE UNIQUE INDEX "Client_tenantId_name_email_key" ON "Client"("tenantId", "name", "email") WHERE "email" IS NOT NULL;

-- Step 3: Add clientId to Lead table (nullable for migration)
ALTER TABLE "Lead" ADD COLUMN "clientId" TEXT;

-- Step 4: Create client records from existing leads
-- Group leads by contactName to create unique clients
INSERT INTO "Client" ("id", "tenantId", "name", "email", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text as "id",
  "tenantId",
  "contactName" as "name",
  MIN("email") as "email",  -- Take first non-null email
  MIN("capturedAt") as "createdAt",
  NOW() as "updatedAt"
FROM "Lead"
WHERE "contactName" IS NOT NULL AND "contactName" != ''
GROUP BY "tenantId", "contactName"
ON CONFLICT DO NOTHING;

-- Step 5: Link existing leads to their clients
UPDATE "Lead" l
SET "clientId" = c."id"
FROM "Client" c
WHERE l."tenantId" = c."tenantId"
  AND l."contactName" = c."name";

-- Step 6: Add clientId to Opportunity table (nullable for migration)
ALTER TABLE "Opportunity" ADD COLUMN "clientId" TEXT;

-- Step 7: Link opportunities to clients via their leads
UPDATE "Opportunity" o
SET "clientId" = l."clientId"
FROM "Lead" l
WHERE o."leadId" = l."id"
  AND l."clientId" IS NOT NULL;

-- Step 8: Add foreign key constraints
ALTER TABLE "Lead" 
  ADD CONSTRAINT "Lead_clientId_fkey" 
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL;

ALTER TABLE "Opportunity" 
  ADD CONSTRAINT "Opportunity_clientId_fkey" 
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL;

-- Step 9: Create indexes for the new foreign keys
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");
CREATE INDEX "Lead_tenantId_clientId_idx" ON "Lead"("tenantId", "clientId");
CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");
CREATE INDEX "Opportunity_tenantId_clientId_idx" ON "Opportunity"("tenantId", "clientId");

-- Step 10: (Future) Once data is migrated and verified, we can:
-- 1. Make clientId NOT NULL on Lead (ALTER TABLE "Lead" ALTER COLUMN "clientId" SET NOT NULL;)
-- 2. Consider deprecating contactName on Lead in favor of client relationship
-- 3. Update application code to always create Client first, then Lead
