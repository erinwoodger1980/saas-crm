-- Set isOwner flag for the dev user
-- Replace 'dev+laj@joinery.ai' with your actual email if different

UPDATE "User" 
SET "isOwner" = true 
WHERE email LIKE '%dev%' OR email LIKE '%laj%' OR role = 'OWNER';

-- Verify the update
SELECT id, email, "isOwner", role 
FROM "User" 
WHERE "isOwner" = true;
