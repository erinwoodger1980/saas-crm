-- First, generate slugs for any tenants that don't have one
DO $$
DECLARE
  tenant_record RECORD;
  base_slug TEXT;
  final_slug TEXT;
  slug_counter INT;
BEGIN
  FOR tenant_record IN 
    SELECT id, name FROM "Tenant" WHERE slug IS NULL
  LOOP
    -- Generate base slug from name
    base_slug := LOWER(REGEXP_REPLACE(tenant_record.name, '[^a-z0-9]+', '-', 'gi'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    
    -- If still empty, use tenant-{id}
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'tenant-' || tenant_record.id;
    END IF;
    
    -- Ensure uniqueness
    final_slug := base_slug;
    slug_counter := 0;
    
    WHILE EXISTS (SELECT 1 FROM "Tenant" WHERE slug = final_slug) LOOP
      slug_counter := slug_counter + 1;
      final_slug := base_slug || '-' || slug_counter;
    END LOOP;
    
    -- Update tenant with generated slug
    UPDATE "Tenant" SET slug = final_slug WHERE id = tenant_record.id;
    RAISE NOTICE 'Generated slug % for tenant %', final_slug, tenant_record.name;
  END LOOP;
END $$;

-- Now make Tenant.slug NOT NULL (all tenants now have slugs)
ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;

-- Drop the LandingTenant.slug column (redundant with Tenant.slug)
ALTER TABLE "LandingTenant" DROP COLUMN IF EXISTS "slug";
