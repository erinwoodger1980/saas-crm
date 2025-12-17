-- Fix productTypes to have default empty array
-- Update existing NULL values to empty array
UPDATE "ComponentLookup" SET "productTypes" = ARRAY[]::TEXT[] WHERE "productTypes" IS NULL;

-- Set default for future inserts
ALTER TABLE "ComponentLookup" ALTER COLUMN "productTypes" SET DEFAULT ARRAY[]::TEXT[];
