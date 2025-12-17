-- AlterTable: Add fireDoorScheduleColumnConfig to TenantSettings
-- This stores per-tenant column width configurations for the fire door schedule grid
ALTER TABLE "TenantSettings" ADD COLUMN "fireDoorScheduleColumnConfig" JSONB;
