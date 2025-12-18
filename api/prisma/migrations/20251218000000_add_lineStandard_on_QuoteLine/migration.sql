-- Add lineStandard Json field to QuoteLine
ALTER TABLE "QuoteLine" ADD COLUMN IF NOT EXISTS "lineStandard" JSONB;
