-- Add color key and assignment grouping fields to WorkshopProcessDefinition
ALTER TABLE "WorkshopProcessDefinition" ADD COLUMN IF NOT EXISTS "isColorKey" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkshopProcessDefinition" ADD COLUMN IF NOT EXISTS "assignmentGroup" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "WorkshopProcessDefinition"."isColorKey" IS 'If true, this process determines the project schedule color based on assigned user';
COMMENT ON COLUMN "WorkshopProcessDefinition"."assignmentGroup" IS 'Group code for batch user assignment (e.g., PRODUCTION assigns user to all processes in that group)';
