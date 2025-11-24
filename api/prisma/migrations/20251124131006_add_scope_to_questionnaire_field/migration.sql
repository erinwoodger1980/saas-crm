-- AddColumn
ALTER TABLE "QuestionnaireField" ADD COLUMN "scope" TEXT DEFAULT 'item';

-- Update existing fields based on group or costingInputKey patterns
UPDATE "QuestionnaireField" 
SET "scope" = 'client' 
WHERE "key" IN ('contact_name', 'email', 'phone', 'lead_source', 'region', 'property_listed', 'timeframe', 'budget_range', 'installation_required', 'additional_notes');

UPDATE "QuestionnaireField" 
SET "scope" = 'internal' 
WHERE "key" IN ('area_m2', 'project_type');

-- Set isHidden for internal fields
UPDATE "QuestionnaireField" 
SET "isHidden" = true 
WHERE "scope" = 'internal';
