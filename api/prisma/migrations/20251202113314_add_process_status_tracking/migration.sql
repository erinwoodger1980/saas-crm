-- Add status and completion tracking to ProjectProcessAssignment
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProjectProcessAssignment' AND column_name = 'status') THEN
    ALTER TABLE "ProjectProcessAssignment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProjectProcessAssignment' AND column_name = 'completionComments') THEN
    ALTER TABLE "ProjectProcessAssignment" ADD COLUMN "completionComments" TEXT;
  END IF;
END $$;

-- Add last process flags to WorkshopProcessDefinition
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WorkshopProcessDefinition' AND column_name = 'isLastManufacturing') THEN
    ALTER TABLE "WorkshopProcessDefinition" ADD COLUMN "isLastManufacturing" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'WorkshopProcessDefinition' AND column_name = 'isLastInstallation') THEN
    ALTER TABLE "WorkshopProcessDefinition" ADD COLUMN "isLastInstallation" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
