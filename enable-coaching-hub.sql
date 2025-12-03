-- Enable Coaching Hub Access
-- Run this SQL to enable the Coaching Hub for your tenant and user

-- 1. Enable Group Coaching for your tenant (replace 'your-tenant-id' with actual tenant ID)
UPDATE "Tenant" 
SET "isGroupCoachingMember" = true 
WHERE id = 'your-tenant-id';

-- Or enable for all tenants:
-- UPDATE "Tenant" SET "isGroupCoachingMember" = true;

-- 2. Mark your user as owner (replace 'your-user-id' with actual user ID)
UPDATE "User" 
SET "isOwner" = true 
WHERE id = 'your-user-id';

-- Or mark a user by email:
-- UPDATE "User" SET "isOwner" = true WHERE email = 'your@email.com';

-- Verify the changes:
SELECT id, name, "isGroupCoachingMember" FROM "Tenant" WHERE "isGroupCoachingMember" = true;
SELECT id, email, "firstName", "lastName", "isOwner" FROM "User" WHERE "isOwner" = true;
