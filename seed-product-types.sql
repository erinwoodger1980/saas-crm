-- Add default product types for tenants
-- This script creates a basic product type hierarchy: Doors and Windows

DO $$
DECLARE
    tenant_record RECORD;
    doors_cat_id TEXT;
    windows_cat_id TEXT;
    interior_type_id TEXT;
    exterior_type_id TEXT;
BEGIN
    -- Loop through all tenants
    FOR tenant_record IN SELECT id FROM "Tenant"
    LOOP
        -- Check if tenant already has product types
        IF NOT EXISTS (SELECT 1 FROM "ProductType" WHERE "tenantId" = tenant_record.id) THEN
            RAISE NOTICE 'Adding product types for tenant: %', tenant_record.id;
            
            -- Category: Doors
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'DOORS',
                'Doors',
                'All door products',
                'category',
                1,
                true
            ) RETURNING id INTO doors_cat_id;
            
            -- Category: Windows
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'WINDOWS',
                'Windows',
                'All window products',
                'category',
                2,
                true
            ) RETURNING id INTO windows_cat_id;
            
            -- Type: Interior Doors (under Doors category)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'INTERIOR_DOOR',
                'Interior Door',
                'Internal doors for residential and commercial use',
                'type',
                doors_cat_id,
                1,
                true
            ) RETURNING id INTO interior_type_id;
            
            -- Type: Exterior Doors (under Doors category)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'EXTERIOR_DOOR',
                'Exterior Door',
                'External doors including front doors and patio doors',
                'type',
                doors_cat_id,
                2,
                true
            ) RETURNING id INTO exterior_type_id;
            
            -- Type: Fire Doors (under Doors category)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'FIRE_DOOR',
                'Fire Door',
                'Fire-rated doors for safety compliance',
                'type',
                doors_cat_id,
                3,
                true
            );
            
            -- Type: Sash Windows (under Windows category)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'SASH_WINDOW',
                'Sash Window',
                'Traditional sliding sash windows',
                'type',
                windows_cat_id,
                1,
                true
            );
            
            -- Type: Casement Windows (under Windows category)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'CASEMENT_WINDOW',
                'Casement Window',
                'Side-hung opening windows',
                'type',
                windows_cat_id,
                2,
                true
            );
            
            -- Option: Standard Interior (under Interior Door type)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'STANDARD_INTERIOR',
                'Standard Interior',
                'Standard internal door',
                'option',
                interior_type_id,
                1,
                true
            );
            
            -- Option: Glazed Interior (under Interior Door type)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'GLAZED_INTERIOR',
                'Glazed Interior',
                'Interior door with glass panels',
                'option',
                interior_type_id,
                2,
                true
            );
            
            -- Option: Standard Exterior (under Exterior Door type)
            INSERT INTO "ProductType" (
                id, "tenantId", code, name, description, level, "parentId", "sortOrder", "isActive"
            ) VALUES (
                gen_random_uuid()::text,
                tenant_record.id,
                'STANDARD_EXTERIOR',
                'Standard Exterior',
                'Standard external door',
                'option',
                exterior_type_id,
                1,
                true
            );
            
        END IF;
    END LOOP;
END $$;
