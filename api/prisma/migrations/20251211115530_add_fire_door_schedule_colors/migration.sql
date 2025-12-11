-- AlterTable (idempotent - only add if not exists)
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "fireDoorScheduleColors" JSONB;
