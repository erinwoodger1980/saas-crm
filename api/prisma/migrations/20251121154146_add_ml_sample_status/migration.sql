-- CreateEnum
CREATE TYPE "MLSampleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MLTrainingSample" ADD COLUMN "status" "MLSampleStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "MLTrainingSample_tenantId_status_idx" ON "MLTrainingSample"("tenantId", "status");
