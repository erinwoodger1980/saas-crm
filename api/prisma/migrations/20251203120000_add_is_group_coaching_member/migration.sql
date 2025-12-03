-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "isGroupCoachingMember" BOOLEAN NOT NULL DEFAULT false;
