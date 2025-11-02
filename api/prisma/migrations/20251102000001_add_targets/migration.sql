-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "enquiriesTarget" INTEGER DEFAULT 0,
    "quotesValueTarget" DECIMAL(65,30) DEFAULT 0,
    "quotesCountTarget" INTEGER DEFAULT 0,
    "salesValueTarget" DECIMAL(65,30) DEFAULT 0,
    "salesCountTarget" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Target_tenantId_year_key" ON "Target"("tenantId", "year");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;