-- Add percent-of-total allocation field to workshop process definitions
ALTER TABLE "WorkshopProcessDefinition"
ADD COLUMN "percentOfTotal" INTEGER;
