-- Add explicit workshop membership flag for Production planning.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isWorkshopUser" BOOLEAN NOT NULL DEFAULT false;

-- Ensure the column remains non-nullable with a sane default even if it already exists.
UPDATE "User" SET "isWorkshopUser" = false WHERE "isWorkshopUser" IS NULL;
ALTER TABLE "User" ALTER COLUMN "isWorkshopUser" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "isWorkshopUser" SET NOT NULL;
