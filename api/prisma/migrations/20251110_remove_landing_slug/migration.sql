-- Make Tenant.slug NOT NULL (all tenants already have slugs from ensure-tenant-slugs script)
ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;

-- Drop the LandingTenant.slug column (redundant with Tenant.slug)
ALTER TABLE "LandingTenant" DROP COLUMN IF EXISTS "slug";
