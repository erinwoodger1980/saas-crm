-- Track AI/vision inference payloads captured during public questionnaires
DO $$ BEGIN
    CREATE TYPE "VisionInferenceSource" AS ENUM ('MEASUREMENT', 'INSPIRATION');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LeadVisionInference" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "itemNumber" INTEGER,
    "source" "VisionInferenceSource" NOT NULL DEFAULT 'MEASUREMENT',
    "widthMm" DOUBLE PRECISION,
    "heightMm" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "attributes" JSONB,
    "description" TEXT,
    "notes" TEXT,
    "photoLabel" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LeadVisionInference_tenant_lead_idx"
    ON "LeadVisionInference" ("tenantId", "leadId");
CREATE INDEX IF NOT EXISTS "LeadVisionInference_lead_item_idx"
    ON "LeadVisionInference" ("leadId", "itemNumber");

ALTER TABLE "LeadVisionInference"
    ADD CONSTRAINT "LeadVisionInference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "LeadVisionInference"
    ADD CONSTRAINT "LeadVisionInference_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE;
