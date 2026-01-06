-- Add lead source to Client (canonical storage for acquisition source)

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Optional supporting index for filtering/grouping by source
CREATE INDEX IF NOT EXISTS "Client_tenantId_source_idx" ON "Client"("tenantId", "source");
