-- AlterTable: Add number field to Lead table (description already exists from previous migration)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Lead' AND column_name = 'number'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "number" TEXT;
  END IF;
END $$;

-- AlterTable: Add number and description fields to Opportunity table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Opportunity' AND column_name = 'number'
  ) THEN
    ALTER TABLE "Opportunity" ADD COLUMN "number" TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Opportunity' AND column_name = 'description'
  ) THEN
    ALTER TABLE "Opportunity" ADD COLUMN "description" TEXT;
  END IF;
END $$;
