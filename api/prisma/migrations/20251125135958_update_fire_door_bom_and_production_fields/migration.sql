-- AlterTable
ALTER TABLE "FireDoorScheduleProject" DROP COLUMN "orderingStatus";
ALTER TABLE "FireDoorScheduleProject" DROP COLUMN "paperworkStatus";

-- Add BOM date tracking fields for each material
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "blanksDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "blanksDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "blanksDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "lippingsDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "lippingsDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "lippingsDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "facingsDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "facingsDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "facingsDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "glassDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "glassDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "glassDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "cassettesDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "cassettesDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "cassettesDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "timbersDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "timbersDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "timbersDateReceived" TIMESTAMP(3);

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "ironmongeryDateOrdered" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "ironmongeryDateExpected" TIMESTAMP(3);
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "ironmongeryDateReceived" TIMESTAMP(3);

-- Add production tracking fields
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "doorSets" INTEGER;
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "leaves" INTEGER;
ALTER TABLE "FireDoorScheduleProject" ADD COLUMN "deliveryNotes" TEXT;
