-- AddColumn scope to QuestionnaireField
ALTER TABLE "QuestionnaireField" ADD COLUMN IF NOT EXISTS "scope" TEXT DEFAULT 'item';

-- Update existing fields based on key patterns
UPDATE "QuestionnaireField" 
SET "scope" = 'client' 
WHERE "key" IN ('contact_name', 'email', 'phone', 'lead_source', 'region', 'property_listed', 'timeframe', 'budget_range', 'installation_required', 'additional_notes');

UPDATE "QuestionnaireField" 
SET "scope" = 'internal' 
WHERE "key" IN ('area_m2', 'project_type');
