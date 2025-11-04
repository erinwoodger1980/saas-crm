-- Add manual approval tracking to ModelVersion
ALTER TABLE "ModelVersion"
  ADD COLUMN "awaitingApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;
