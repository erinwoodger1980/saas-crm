-- Add startDate and deliveryDate to Opportunity table
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "deliveryDate" TIMESTAMP(3);
