-- Add isStandard and isHidden flags to QuestionnaireField
-- isStandard: true for system-defined ML training fields (cannot be deleted)
-- isHidden: allows hiding standard fields if not relevant to tenant's business

ALTER TABLE "QuestionnaireField" 
  ADD COLUMN IF NOT EXISTS "isStandard" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "QuestionnaireField" 
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- Add index for querying active standard fields
CREATE INDEX IF NOT EXISTS "QuestionnaireField_isStandard_isActive_idx" 
  ON "QuestionnaireField" ("isStandard", "isActive");

-- Add index for efficient standard field lookups
CREATE INDEX IF NOT EXISTS "QuestionnaireField_tenantId_isStandard_idx" 
  ON "QuestionnaireField" ("tenantId", "isStandard");
