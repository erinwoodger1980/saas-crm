-- Manual migration to add AnalyticsEvent table
-- Generated 2025-11-29

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT,
  "utm" JSONB,
  "stepIndex" INTEGER,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign key to Tenant
ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite index for query performance
CREATE INDEX "AnalyticsEvent_tenant_type_timestamp_idx" ON "AnalyticsEvent"("tenantId", "type", "timestamp");
