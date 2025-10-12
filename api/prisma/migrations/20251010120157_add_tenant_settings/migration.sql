-- CreateTable
CREATE TABLE "TenantSettings" (
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "introHtml" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "links" JSONB,
    "questionnaire" JSONB,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_slug_key" ON "TenantSettings"("slug");
