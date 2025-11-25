-- Enable fire door manufacturer flag for LAJ Joinery tenant
-- Run this in the database console or via psql

-- First, find the LAJ Joinery tenant ID
SELECT id, name FROM "Tenant" WHERE name LIKE '%LAJ%' OR name LIKE '%Joinery%';

-- Enable the fire door manufacturer flag (replace TENANT_ID with actual ID from above)
-- The tenant ID should be: cmi58fkzm0000it43i4h78pej
UPDATE "TenantSettings" 
SET "isFireDoorManufacturer" = true 
WHERE "tenantId" = 'cmi58fkzm0000it43i4h78pej';

-- If the TenantSettings record doesn't exist, create it:
INSERT INTO "TenantSettings" ("tenantId", "isFireDoorManufacturer", "createdAt", "updatedAt")
VALUES ('cmi58fkzm0000it43i4h78pej', true, NOW(), NOW())
ON CONFLICT ("tenantId") 
DO UPDATE SET "isFireDoorManufacturer" = true, "updatedAt" = NOW();

-- Verify the setting
SELECT ts."tenantId", t.name, ts."isFireDoorManufacturer"
FROM "TenantSettings" ts
JOIN "Tenant" t ON t.id = ts."tenantId"
WHERE ts."tenantId" = 'cmi58fkzm0000it43i4h78pej';

-- Check how many fire door projects exist
SELECT COUNT(*) as project_count 
FROM "FireDoorScheduleProject" 
WHERE "tenantId" = 'cmi58fkzm0000it43i4h78pej';
