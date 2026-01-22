-- Add "Del Date Agreed By" to FireDoorScheduleProject

ALTER TABLE "FireDoorScheduleProject" ADD COLUMN IF NOT EXISTS "delDateAgreedBy" TEXT;
