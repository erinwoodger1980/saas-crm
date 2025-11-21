-- Add global specification fields for questionnaire auto descriptions
ALTER TABLE "Lead"
  ADD COLUMN "globalTimberSpec" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "globalGlassSpec" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "globalIronmongerySpec" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "globalFinishSpec" TEXT NOT NULL DEFAULT '';
