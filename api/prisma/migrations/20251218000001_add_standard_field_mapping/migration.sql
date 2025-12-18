-- StandardFieldMapping: Defines overrides for standard line-item fields per product type
CREATE TABLE "StandardFieldMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "productTypeId" TEXT NOT NULL,
  "standardField" TEXT NOT NULL, -- e.g., "widthMm", "heightMm", "timber", "finish", "ironmongery", "glazing", "description", "photoInside", "photoOutside"
  "questionCode" TEXT, -- link to Question.attributeCode for override source
  "attributeCode" TEXT, -- alternative: link to Attribute.code for override source
  "transformExpression" TEXT, -- optional JS expression to transform value before applying
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StandardFieldMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "StandardFieldMapping_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "StandardFieldMapping_tenantId_productTypeId_standardField_key" ON "StandardFieldMapping"("tenantId", "productTypeId", "standardField");
CREATE INDEX "StandardFieldMapping_tenantId_idx" ON "StandardFieldMapping"("tenantId");
CREATE INDEX "StandardFieldMapping_productTypeId_idx" ON "StandardFieldMapping"("productTypeId");
CREATE INDEX "StandardFieldMapping_standardField_idx" ON "StandardFieldMapping"("standardField");
