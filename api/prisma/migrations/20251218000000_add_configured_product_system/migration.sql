-- Phase 1: Add canonical ConfiguredProduct system to QuoteLine
-- This migration adds the foundation for a unified product configuration model
-- that supports incremental migration from the legacy questionnaire system

-- 1. Add configuredProduct JSONB column to QuoteLine
-- Structure: {
--   productTypeId: string (references ProductType.id),
--   selections: Record<attributeCode, value>,
--   derived?: { bom?, processes?, costs?, drawing? },
--   provenance?: Record<attributeCode, 'user'|'ai'|'default'|'legacy'>
-- }
ALTER TABLE "QuoteLine" ADD COLUMN IF NOT EXISTS "configuredProduct" JSONB;
CREATE INDEX IF NOT EXISTS "QuoteLine_configuredProduct_idx" ON "QuoteLine" USING GIN ("configuredProduct");

-- 2. ProductType: Tree-structured product type taxonomy (category -> type -> option)
CREATE TABLE IF NOT EXISTS "ProductType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL CHECK ("level" IN ('category', 'type', 'option')),
    "parentId" TEXT,
    "questionSetId" TEXT,
    "svgPreview" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductType_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductType"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_tenantId_code_key" ON "ProductType"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "ProductType_tenantId_idx" ON "ProductType"("tenantId");
CREATE INDEX IF NOT EXISTS "ProductType_parentId_idx" ON "ProductType"("parentId");
CREATE INDEX IF NOT EXISTS "ProductType_level_idx" ON "ProductType"("level");

-- 3. Attribute: Universal attribute system (replaces fragmented questionnaire fields)
CREATE TABLE IF NOT EXISTS "Attribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributeType" TEXT NOT NULL CHECK ("attributeType" IN ('number', 'text', 'select', 'multiselect', 'boolean', 'date', 'json')),
    "unit" TEXT,
    "options" JSONB,
    "defaultValue" TEXT,
    "validationRules" JSONB,
    "requiredForCosting" BOOLEAN NOT NULL DEFAULT false,
    "requiredForManufacture" BOOLEAN NOT NULL DEFAULT false,
    "affectsPrice" BOOLEAN NOT NULL DEFAULT false,
    "affectsBOM" BOOLEAN NOT NULL DEFAULT false,
    "calculationFormula" TEXT,
    "hints" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Attribute_tenantId_code_key" ON "Attribute"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Attribute_tenantId_idx" ON "Attribute"("tenantId");
CREATE INDEX IF NOT EXISTS "Attribute_code_idx" ON "Attribute"("code");

-- 4. Question: UI presentation layer over Attributes
CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "attributeCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "placeholder" TEXT,
    "controlType" TEXT NOT NULL CHECK ("controlType" IN ('input', 'select', 'radio', 'checkbox', 'slider', 'date', 'textarea')),
    "visibilityRules" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Question_tenantId_idx" ON "Question"("tenantId");
CREATE INDEX IF NOT EXISTS "Question_attributeCode_idx" ON "Question"("attributeCode");

-- 5. QuestionSet: Groups questions for product types
CREATE TABLE IF NOT EXISTS "QuestionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productTypeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "QuestionSet_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "QuestionSet_tenantId_idx" ON "QuestionSet"("tenantId");
CREATE INDEX IF NOT EXISTS "QuestionSet_productTypeId_idx" ON "QuestionSet"("productTypeId");

-- 6. QuestionSetQuestion: Join table for questions in question sets
CREATE TABLE IF NOT EXISTS "QuestionSetQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionSetId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSetQuestion_questionSetId_fkey" FOREIGN KEY ("questionSetId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE,
    CONSTRAINT "QuestionSetQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuestionSetQuestion_questionSetId_questionId_key" ON "QuestionSetQuestion"("questionSetId", "questionId");
CREATE INDEX IF NOT EXISTS "QuestionSetQuestion_questionSetId_idx" ON "QuestionSetQuestion"("questionSetId");

-- 7. LegacyQuestionMapping: Dual-write migration bridge
CREATE TABLE IF NOT EXISTS "LegacyQuestionMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "legacyFieldId" TEXT NOT NULL,
    "legacyFieldKey" TEXT,
    "attributeCode" TEXT NOT NULL,
    "transformExpression" TEXT,
    "inverseTransformExpression" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegacyQuestionMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
    CONSTRAINT "LegacyQuestionMapping_legacyFieldId_fkey" FOREIGN KEY ("legacyFieldId") REFERENCES "QuestionnaireField"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegacyQuestionMapping_legacyFieldId_key" ON "LegacyQuestionMapping"("legacyFieldId");
CREATE INDEX IF NOT EXISTS "LegacyQuestionMapping_tenantId_idx" ON "LegacyQuestionMapping"("tenantId");
CREATE INDEX IF NOT EXISTS "LegacyQuestionMapping_attributeCode_idx" ON "LegacyQuestionMapping"("attributeCode");

-- 8. Add questionSetId foreign key to ProductType (referenced above)
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_questionSetId_fkey" 
    FOREIGN KEY ("questionSetId") REFERENCES "QuestionSet"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ProductType_questionSetId_idx" ON "ProductType"("questionSetId");

-- 9. Extend ComponentLookup with inclusion rules for dynamic BOM generation
ALTER TABLE "ComponentLookup" ADD COLUMN IF NOT EXISTS "inclusionRules" JSONB;
ALTER TABLE "ComponentLookup" ADD COLUMN IF NOT EXISTS "quantityFormula" TEXT;
COMMENT ON COLUMN "ComponentLookup"."inclusionRules" IS 'JSON rules for when component is included based on configuredProduct.selections';
COMMENT ON COLUMN "ComponentLookup"."quantityFormula" IS 'Formula to calculate quantity based on dimensions and selections';

-- Notes for implementation:
-- 1. Keep ALL existing tables unchanged (Quote, QuoteLine.meta, QuestionnaireField, QuestionnaireAnswer)
-- 2. Dual-write strategy: When QuestionnaireAnswer saved, ALSO write to QuoteLine.configuredProduct.selections via LegacyQuestionMapping
-- 3. ML payload builder should read configuredProduct.selections FIRST, fall back to legacy storage
-- 4. UI can render both legacy QuestionnaireField and new QuestionSet forms during transition
-- 5. New quotes should use ProductType selector + QuestionSet renderer
-- 6. Phase 2 will add component inclusion logic and derived field calculations
