-- 20250214000000_ml_backbone_logging
CREATE TABLE IF NOT EXISTS "ParsedSupplierLine" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "tenantId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "page" INTEGER,
  "rawText" TEXT NOT NULL,
  "description" TEXT,
  "qty" DOUBLE PRECISION,
  "costUnit" DOUBLE PRECISION,
  "lineTotal" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "supplier" TEXT,
  "confidence" DOUBLE PRECISION,
  "usedStages" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ParsedSupplierLine_tenant_quote_idx"
  ON "ParsedSupplierLine" ("tenantId", "quoteId");
CREATE INDEX IF NOT EXISTS "ParsedSupplierLine_tenant_supplier_idx"
  ON "ParsedSupplierLine" ("tenantId", "supplier");

CREATE TABLE IF NOT EXISTS "Estimate" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "tenantId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "inputType" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "estimatedTotal" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "promoted" BOOLEAN NOT NULL DEFAULT FALSE,
  "actualAcceptedPrice" DOUBLE PRECISION,
  "outcome" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Estimate_tenant_quote_idx"
  ON "Estimate" ("tenantId", "quoteId");
CREATE INDEX IF NOT EXISTS "Estimate_tenant_created_idx"
  ON "Estimate" ("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "InferenceEvent" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "tenantId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "outputJson" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InferenceEvent_tenant_model_created_idx"
  ON "InferenceEvent" ("tenantId", "model", "createdAt");
CREATE INDEX IF NOT EXISTS "InferenceEvent_tenant_created_idx"
  ON "InferenceEvent" ("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "ModelVersion" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "model" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "metricsJson" JSONB NOT NULL,
  "datasetHash" TEXT NOT NULL,
  "isProduction" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ModelVersion_model_isProduction_idx"
  ON "ModelVersion" ("model", "isProduction");

CREATE TABLE IF NOT EXISTS "TrainingRun" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "tenantId" TEXT,
  "model" TEXT NOT NULL,
  "datasetHash" TEXT NOT NULL,
  "metricsJson" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TrainingRun_model_created_idx"
  ON "TrainingRun" ("model", "createdAt");
CREATE INDEX IF NOT EXISTS "TrainingRun_tenant_created_idx"
  ON "TrainingRun" ("tenantId", "createdAt");
