-- CreateTable: FireDoorImport
CREATE TABLE "FireDoorImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "FireDoorImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FireDoorLineItem
CREATE TABLE "FireDoorLineItem" (
    "id" TEXT NOT NULL,
    "fireDoorImportId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "itemType" TEXT,
    "code" TEXT,
    "quantity" INTEGER,
    "doorRef" TEXT,
    "location" TEXT,
    "doorSetType" TEXT,
    "fireRating" TEXT,
    "acousticRatingDb" INTEGER,
    "handing" TEXT,
    "internalColour" TEXT,
    "externalColour" TEXT,
    "frameFinish" TEXT,
    "leafHeight" DOUBLE PRECISION,
    "masterLeafWidth" DOUBLE PRECISION,
    "slaveLeafWidth" DOUBLE PRECISION,
    "leafThickness" DOUBLE PRECISION,
    "leafConfiguration" TEXT,
    "ifSplitMasterSize" TEXT,
    "doorFinishSide1" TEXT,
    "doorFinishSide2" TEXT,
    "doorFacing" TEXT,
    "lippingFinish" TEXT,
    "doorEdgeProtType" TEXT,
    "doorEdgeProtPos" TEXT,
    "doorUndercut" TEXT,
    "doorUndercutMm" DOUBLE PRECISION,
    "visionQtyLeaf1" INTEGER,
    "vp1WidthLeaf1" DOUBLE PRECISION,
    "vp1HeightLeaf1" DOUBLE PRECISION,
    "vp2WidthLeaf1" DOUBLE PRECISION,
    "vp2HeightLeaf1" DOUBLE PRECISION,
    "visionQtyLeaf2" INTEGER,
    "vp1WidthLeaf2" DOUBLE PRECISION,
    "vp1HeightLeaf2" DOUBLE PRECISION,
    "vp2WidthLeaf2" DOUBLE PRECISION,
    "vp2HeightLeaf2" DOUBLE PRECISION,
    "totalGlazedAreaMaster" DOUBLE PRECISION,
    "fanlightSidelightGlz" TEXT,
    "glazingTape" TEXT,
    "ironmongeryPackRef" TEXT,
    "closerOrFloorSpring" TEXT,
    "spindleFacePrep" TEXT,
    "cylinderFacePrep" TEXT,
    "flushBoltSupplyPrep" TEXT,
    "flushBoltQty" INTEGER,
    "fingerProtection" TEXT,
    "fireSignage" TEXT,
    "fireSignageQty" INTEGER,
    "fireSignageFactoryFit" TEXT,
    "fireIdDisc" TEXT,
    "fireIdDiscQty" INTEGER,
    "doorViewer" TEXT,
    "doorViewerPosition" TEXT,
    "doorViewerPrepSize" TEXT,
    "doorChain" TEXT,
    "doorViewersQty" INTEGER,
    "doorChainFactoryFit" TEXT,
    "doorViewersFactoryFit" TEXT,
    "additionNote1" TEXT,
    "additionNote1Qty" INTEGER,
    "unitValue" DECIMAL(65,30),
    "labourCost" DECIMAL(65,30),
    "materialCost" DECIMAL(65,30),
    "lineTotal" DECIMAL(65,30),
    "rawRowJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FireDoorLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FireDoorImport_tenantId_status_idx" ON "FireDoorImport"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FireDoorImport_tenantId_createdAt_idx" ON "FireDoorImport"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FireDoorLineItem_tenantId_fireDoorImportId_idx" ON "FireDoorLineItem"("tenantId", "fireDoorImportId");

-- CreateIndex
CREATE INDEX "FireDoorLineItem_tenantId_fireRating_idx" ON "FireDoorLineItem"("tenantId", "fireRating");

-- CreateIndex
CREATE INDEX "FireDoorLineItem_fireDoorImportId_rowIndex_idx" ON "FireDoorLineItem"("fireDoorImportId", "rowIndex");

-- AddForeignKey
ALTER TABLE "FireDoorLineItem" ADD CONSTRAINT "FireDoorLineItem_fireDoorImportId_fkey" FOREIGN KEY ("fireDoorImportId") REFERENCES "FireDoorImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
