-- AlterTable
ALTER TABLE "ComponentLookup" ADD COLUMN     "positionXFormula" TEXT,
ADD COLUMN     "positionYFormula" TEXT,
ADD COLUMN     "positionZFormula" TEXT,
ADD COLUMN     "widthFormula" TEXT,
ADD COLUMN     "heightFormula" TEXT,
ADD COLUMN     "depthFormula" TEXT,
ADD COLUMN     "bodyProfileId" TEXT,
ADD COLUMN     "startEndProfileId" TEXT,
ADD COLUMN     "endEndProfileId" TEXT;

-- CreateIndex
CREATE INDEX "ComponentLookup_bodyProfileId_idx" ON "ComponentLookup"("bodyProfileId");

-- AddForeignKey
ALTER TABLE "ComponentLookup" ADD CONSTRAINT "ComponentLookup_bodyProfileId_fkey" FOREIGN KEY ("bodyProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentLookup" ADD CONSTRAINT "ComponentLookup_startEndProfileId_fkey" FOREIGN KEY ("startEndProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentLookup" ADD CONSTRAINT "ComponentLookup_endEndProfileId_fkey" FOREIGN KEY ("endEndProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
