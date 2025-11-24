-- Add optional PdfLayoutTemplate columns if missing (idempotent)
-- Supports legacy deployments that created the table without pageCount/meta/createdByUserId
-- PostgreSQL syntax using DO block for conditional alters
DO $$
BEGIN
    -- pageCount INT
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PdfLayoutTemplate' AND column_name = 'pageCount'
    ) THEN
        ALTER TABLE "PdfLayoutTemplate" ADD COLUMN "pageCount" INT;
    END IF;

    -- meta JSONB (if JSON already exists as JSON type, skip)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PdfLayoutTemplate' AND column_name = 'meta'
    ) THEN
        ALTER TABLE "PdfLayoutTemplate" ADD COLUMN "meta" JSONB;
    END IF;

    -- createdByUserId TEXT referencing User(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PdfLayoutTemplate' AND column_name = 'createdByUserId'
    ) THEN
        ALTER TABLE "PdfLayoutTemplate" ADD COLUMN "createdByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Safety: ensure index on name exists (only create if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'PdfLayoutTemplate' AND indexname = 'PdfLayoutTemplate_name_idx'
    ) THEN
        CREATE INDEX "PdfLayoutTemplate_name_idx" ON "PdfLayoutTemplate"("name");
    END IF;
END
$$;
