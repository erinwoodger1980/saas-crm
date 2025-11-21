-- Migration: Add branding & social proof fields to TenantSettings
-- Safe additive migration; columns added only if missing.

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "galleryImageUrls" TEXT[] DEFAULT '{}';
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "testimonials" JSONB;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reviewScore" DECIMAL;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "reviewSourceLabel" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "serviceArea" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "isFireDoorManufacturer" BOOLEAN DEFAULT FALSE;

-- Ensure updatedAt will reflect changes (touch row without changing semantics)
UPDATE "TenantSettings" SET "updatedAt" = NOW() WHERE "updatedAt" < NOW();