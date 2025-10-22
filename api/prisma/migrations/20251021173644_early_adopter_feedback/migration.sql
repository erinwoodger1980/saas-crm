-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Feedback"
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN';

-- CreateIndex
CREATE INDEX "Feedback_tenantId_status_createdAt_idx" ON "Feedback"("tenantId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
