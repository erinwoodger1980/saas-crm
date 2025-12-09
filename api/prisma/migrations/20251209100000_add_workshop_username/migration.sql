-- Add workshopUsername field for username-based login
-- Allows workshop users to log in without an email address

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workshopUsername" TEXT;

-- Create unique index on workshopUsername
CREATE UNIQUE INDEX IF NOT EXISTS "User_workshopUsername_key" ON "User"("workshopUsername");
