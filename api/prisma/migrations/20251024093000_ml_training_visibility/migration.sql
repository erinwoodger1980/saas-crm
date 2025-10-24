-- Create ML training visibility tables if they don't exist yet
-- This migration is idempotent (IF NOT EXISTS) so it can be applied safely on existing DBs

-- TrainingInsights
CREATE TABLE IF NOT EXISTS "TrainingInsights" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "module" text NOT NULL,
  "inputSummary" text,
  "decision" text,
  "confidence" double precision,
  "userFeedback" jsonb,
  "lastUpdated" timestamptz DEFAULT now(),
  "createdAt" timestamptz DEFAULT now(),
  CONSTRAINT "TrainingInsights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainingInsights_tenant_module_createdAt_idx"
  ON "TrainingInsights" ("tenantId", "module", "createdAt");

-- ModelOverride
CREATE TABLE IF NOT EXISTS "ModelOverride" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "module" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "reason" text,
  "createdById" text,
  "createdAt" timestamptz DEFAULT now(),
  CONSTRAINT "ModelOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ModelOverride_tenant_module_key_idx"
  ON "ModelOverride" ("tenantId", "module", "key");

-- TrainingEvent
CREATE TABLE IF NOT EXISTS "TrainingEvent" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "module" text NOT NULL,
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "actorId" text,
  "createdAt" timestamptz DEFAULT now(),
  CONSTRAINT "TrainingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainingEvent_tenant_module_kind_createdAt_idx"
  ON "TrainingEvent" ("tenantId", "module", "kind", "createdAt");
