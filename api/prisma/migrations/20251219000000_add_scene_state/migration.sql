-- CreateTable SceneState
CREATE TABLE IF NOT EXISTS "SceneState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "modifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SceneState_tenantId_entityType_entityId_key" ON "SceneState"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SceneState_tenantId_idx" ON "SceneState"("tenantId");

-- CreateIndex
CREATE INDEX "SceneState_tenantId_entityType_idx" ON "SceneState"("tenantId", "entityType");

-- AddForeignKey
ALTER TABLE "SceneState" ADD CONSTRAINT "SceneState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
