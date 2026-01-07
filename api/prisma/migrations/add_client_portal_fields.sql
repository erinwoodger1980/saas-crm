-- Add new fields for Client Portal tab to FireDoorScheduleProject
ALTER TABLE "FireDoorScheduleProject"
ADD COLUMN IF NOT EXISTS "clientOrderNo" TEXT,
ADD COLUMN IF NOT EXISTS "typeOfJob" TEXT,
ADD COLUMN IF NOT EXISTS "lajClientComments" TEXT,
ADD COLUMN IF NOT EXISTS "clientComments" TEXT,
ADD COLUMN IF NOT EXISTS "factoryFitIronmongeryReleased" TEXT,
ADD COLUMN IF NOT EXISTS "qrCodes" BOOLEAN NOT NULL DEFAULT false;
