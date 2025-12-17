-- ComponentProcess: Links components to workshop processes with time estimates
CREATE TABLE IF NOT EXISTS "ComponentProcess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentLookupId" TEXT NOT NULL,
    "processDefinitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "baseTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "setupTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formulaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "formulaExpression" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentProcess_componentLookupId_fkey" FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE CASCADE,
    CONSTRAINT "ComponentProcess_processDefinitionId_fkey" FOREIGN KEY ("processDefinitionId") REFERENCES "WorkshopProcessDefinition"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComponentProcess_componentLookupId_processDefinitionId_key" ON "ComponentProcess"("componentLookupId", "processDefinitionId");
CREATE INDEX IF NOT EXISTS "ComponentProcess_componentLookupId_idx" ON "ComponentProcess"("componentLookupId");
CREATE INDEX IF NOT EXISTS "ComponentProcess_processDefinitionId_idx" ON "ComponentProcess"("processDefinitionId");

-- ProcessTimingPrediction: ML-powered timing predictions learned from actual workshop timers
CREATE TABLE IF NOT EXISTS "ProcessTimingPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "processDefinitionId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "productType" TEXT,
    "predictedMinutes" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "averageActualMinutes" DOUBLE PRECISION,
    "minActualMinutes" DOUBLE PRECISION,
    "maxActualMinutes" DOUBLE PRECISION,
    "stdDeviation" DOUBLE PRECISION,
    "lastLearnedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessTimingPrediction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "ProcessTimingPrediction_processDefinitionId_fkey" FOREIGN KEY ("processDefinitionId") REFERENCES "WorkshopProcessDefinition"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcessTimingPrediction_tenantId_processDefinitionId_componentType_productType_key" ON "ProcessTimingPrediction"("tenantId", "processDefinitionId", "componentType", "productType");
CREATE INDEX IF NOT EXISTS "ProcessTimingPrediction_tenantId_idx" ON "ProcessTimingPrediction"("tenantId");
CREATE INDEX IF NOT EXISTS "ProcessTimingPrediction_processDefinitionId_idx" ON "ProcessTimingPrediction"("processDefinitionId");
CREATE INDEX IF NOT EXISTS "ProcessTimingPrediction_componentType_idx" ON "ProcessTimingPrediction"("componentType");

-- ProcessCostRate: Labor cost per hour for each process (time-based rates for costing)
CREATE TABLE IF NOT EXISTS "ProcessCostRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "processDefinitionId" TEXT NOT NULL,
    "costPerHour" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessCostRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "ProcessCostRate_processDefinitionId_fkey" FOREIGN KEY ("processDefinitionId") REFERENCES "WorkshopProcessDefinition"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProcessCostRate_tenantId_idx" ON "ProcessCostRate"("tenantId");
CREATE INDEX IF NOT EXISTS "ProcessCostRate_processDefinitionId_idx" ON "ProcessCostRate"("processDefinitionId");
CREATE INDEX IF NOT EXISTS "ProcessCostRate_effectiveFrom_idx" ON "ProcessCostRate"("effectiveFrom");
