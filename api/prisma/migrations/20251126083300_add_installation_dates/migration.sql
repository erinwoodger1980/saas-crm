-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "installationStartDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "installationEndDate" TIMESTAMP(3);

