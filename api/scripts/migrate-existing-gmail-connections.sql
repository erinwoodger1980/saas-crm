-- One-time migration: Enable inbox watch for all existing Gmail connections
-- Run this ONCE in your Render PostgreSQL dashboard after deploying the fix

-- Enable inbox watch for all tenants that have Gmail connections
UPDATE "TenantSettings" ts
SET 
  "inboxWatchEnabled" = true,
  "inbox" = COALESCE(ts."inbox", '{}'::jsonb) || '{"gmail": true}'::jsonb
WHERE EXISTS (
  SELECT 1 FROM "GmailTenantConnection" gtc
  WHERE gtc."tenantId" = ts."tenantId"
)
AND ("inboxWatchEnabled" IS NULL OR "inboxWatchEnabled" = false);

-- Verify the changes
SELECT 
  ts."tenantId",
  ts."brandName",
  ts."inboxWatchEnabled",
  ts."inbox",
  gtc."gmailAddress"
FROM "TenantSettings" ts
JOIN "GmailTenantConnection" gtc ON gtc."tenantId" = ts."tenantId"
ORDER BY gtc."createdAt" DESC;
