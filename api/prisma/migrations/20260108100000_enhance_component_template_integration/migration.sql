-- AlterTable: Add ComponentLookup link to ComponentTemplate (with IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComponentTemplate' AND column_name = 'componentLookupId') THEN
        ALTER TABLE "ComponentTemplate" ADD COLUMN "componentLookupId" TEXT;
    END IF;
END $$;

-- AlterTable: Add AI integration fields to ComponentTemplate
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComponentTemplate' AND column_name = 'aiCategories') THEN
        ALTER TABLE "ComponentTemplate" ADD COLUMN "aiCategories" TEXT[];
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComponentTemplate' AND column_name = 'aiKeywords') THEN
        ALTER TABLE "ComponentTemplate" ADD COLUMN "aiKeywords" TEXT[];
    END IF;
END $$;

-- AlterTable: Add ProductType linking to ComponentTemplate
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComponentTemplate' AND column_name = 'productTypeIds') THEN
        ALTER TABLE "ComponentTemplate" ADD COLUMN "productTypeIds" TEXT[];
    END IF;
END $$;

-- CreateIndex: Index on componentLookupId for faster joins (with IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ComponentTemplate_componentLookupId_idx') THEN
        CREATE INDEX "ComponentTemplate_componentLookupId_idx" ON "ComponentTemplate"("componentLookupId");
    END IF;
END $$;

-- CreateIndex: Index on productTypeIds for array queries (with IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ComponentTemplate_productTypeIds_idx') THEN
        CREATE INDEX "ComponentTemplate_productTypeIds_idx" ON "ComponentTemplate" USING GIN ("productTypeIds");
    END IF;
END $$;

-- AddForeignKey: Link to ComponentLookup (with IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ComponentTemplate_componentLookupId_fkey'
    ) THEN
        ALTER TABLE "ComponentTemplate" ADD CONSTRAINT "ComponentTemplate_componentLookupId_fkey" 
        FOREIGN KEY ("componentLookupId") REFERENCES "ComponentLookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
