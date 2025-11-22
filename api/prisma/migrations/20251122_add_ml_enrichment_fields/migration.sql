-- Add enrichment fields to MLTrainingSample
ALTER TABLE "MLTrainingSample" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "MLTrainingSample" ADD COLUMN IF NOT EXISTS "estimatedTotal" DECIMAL(65,30);
ALTER TABLE "MLTrainingSample" ADD COLUMN IF NOT EXISTS "textChars" INTEGER;
ALTER TABLE "MLTrainingSample" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "MLTrainingSample" ADD COLUMN IF NOT EXISTS "filename" TEXT;
