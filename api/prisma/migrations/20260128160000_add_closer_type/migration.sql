-- Add closerType column to FireDoorLineItem
ALTER TABLE "FireDoorLineItem" ADD COLUMN "closerType" TEXT;

-- Preserve existing linked values so the new column starts with the same data
UPDATE "FireDoorLineItem"
SET "closerType" = "closerOrFloorSpring"
WHERE "closerType" IS NULL AND "closerOrFloorSpring" IS NOT NULL;
