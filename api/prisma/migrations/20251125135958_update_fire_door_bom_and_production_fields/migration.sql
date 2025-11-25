-- AlterTable (drop columns if they exist)
ALTER TABLE "FireDoorScheduleProject" DROP COLUMN IF EXISTS "orderingStatus";
ALTER TABLE "FireDoorScheduleProject" DROP COLUMN IF EXISTS "paperworkStatus";

-- Add BOM date tracking fields for each material (idempotent)
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "blanksDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "blanksDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "blanksDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "lippingsDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "lippingsDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "lippingsDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "facingsDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "facingsDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "facingsDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "glassDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "glassDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "glassDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "cassettesDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "cassettesDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "cassettesDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "timbersDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "timbersDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "timbersDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "ironmongeryDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "ironmongeryDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "ironmongeryDateReceived" TIMESTAMP(3);

-- Add production tracking fields (idempotent)
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "doorSets" INTEGER;
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "leaves" INTEGER;
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT;
