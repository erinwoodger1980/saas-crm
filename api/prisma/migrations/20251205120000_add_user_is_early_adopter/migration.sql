-- Add the beta flag used by the application to gate early access features.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false;

-- Ensure the column remains non-nullable with a sane default even if it already exists.
UPDATE "User" SET "isEarlyAdopter" = false WHERE "isEarlyAdopter" IS NULL;
ALTER TABLE "User" ALTER COLUMN "isEarlyAdopter" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "isEarlyAdopter" SET NOT NULL;
