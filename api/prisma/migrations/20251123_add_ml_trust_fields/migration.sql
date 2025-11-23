-- Add ML trust and approval workflow fields to Quote
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "mlEstimatedPrice" DECIMAL;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "mlConfidence" DECIMAL;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "mlModelVersion" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'pending';
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "approvedPrice" DECIMAL;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "priceVariancePercent" DECIMAL;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "isTrainingExample" BOOLEAN DEFAULT false;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "trainingNotes" TEXT;

-- Add index for approval workflow queries
CREATE INDEX IF NOT EXISTS "Quote_approvalStatus_idx" ON "Quote"("approvalStatus");
CREATE INDEX IF NOT EXISTS "Quote_isTrainingExample_idx" ON "Quote"("isTrainingExample");
CREATE INDEX IF NOT EXISTS "Quote_tenantId_approvalStatus_idx" ON "Quote"("tenantId", "approvalStatus");

-- Create MLAccuracyMetric table to track ML performance over time
CREATE TABLE IF NOT EXISTS "MLAccuracyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalQuotes" INTEGER NOT NULL DEFAULT 0,
    "accurateWithin10Pct" INTEGER NOT NULL DEFAULT 0,
    "accurateWithin20Pct" INTEGER NOT NULL DEFAULT 0,
    "averageVariancePct" DECIMAL,
    "medianVariancePct" DECIMAL,
    "confidenceAvg" DECIMAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MLAccuracyMetric_tenantId_idx" ON "MLAccuracyMetric"("tenantId");
CREATE INDEX IF NOT EXISTS "MLAccuracyMetric_tenantId_periodStart_idx" ON "MLAccuracyMetric"("tenantId", "periodStart");

-- Add foreign key for approvedById
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
