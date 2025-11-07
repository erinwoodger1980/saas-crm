-- Enable inbox watch for Wealden Joinery tenant
-- Run this in your Render PostgreSQL dashboard or via psql

UPDATE "TenantSettings"
SET "inboxWatchEnabled" = true
WHERE "tenantId" = 'cmgt7eozw0000sh2htcmplljf';

-- Verify the change
SELECT 
  "tenantId",
  "brandName",
  "inboxWatchEnabled",
  "inbox"
FROM "TenantSettings"
WHERE "tenantId" = 'cmgt7eozw0000sh2htcmplljf';
