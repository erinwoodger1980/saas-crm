-- CreateTable
CREATE TABLE "FireDoorBOM" (
    "id" TEXT NOT NULL,
    "fireDoorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "bomData" JSONB NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FireDoorBOM_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FireDoorBOM_fireDoorId_key" ON "FireDoorBOM"("fireDoorId");

-- CreateIndex
CREATE INDEX "FireDoorBOM_tenantId_idx" ON "FireDoorBOM"("tenantId");

-- CreateIndex
CREATE INDEX "FireDoorBOM_productTypeId_idx" ON "FireDoorBOM"("productTypeId");

-- CreateIndex
CREATE INDEX "FireDoorBOM_createdAt_idx" ON "FireDoorBOM"("createdAt");

-- AddForeignKey
ALTER TABLE "FireDoorBOM" ADD CONSTRAINT "FireDoorBOM_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
