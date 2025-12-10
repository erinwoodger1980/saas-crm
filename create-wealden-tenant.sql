-- Create LandingTenant record for existing Wealden Joinery tenant
-- Run this in the production database

-- Get the tenant ID for Wealden Joinery
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM "Tenant" WHERE slug = 'wealden-joinery';
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant with slug wealden-joinery not found';
  END IF;
  
  -- Create LandingTenant record
  INSERT INTO "LandingTenant" (
    id, "tenantId", name, headline, subhead, "ctaText", email, phone, address, "homeUrl", "brandColor",
    guarantees, "publishedAt", "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    'Wealden Joinery',
    'Hand-Crafted Oak & Accoya Windows and Doors',
    'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
    'Get Your Free Quote',
    'info@wealdenjoinery.com',
    '01892 852544',
    'Rotherfield, East Sussex',
    'https://www.wealdenjoinery.com',
    '#8B4513',
    ARRAY[
      '50-year anti-rot guarantee on Accoya timber',
      'Super prime and prime grade European oak',
      'All craftsmen City & Guilds qualified',
      'FSC certified sustainable timber',
      'Listed building specialists',
      'Made in our Rotherfield workshop'
    ],
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT ("tenantId") DO UPDATE SET
    headline = EXCLUDED.headline,
    subhead = EXCLUDED.subhead,
    "ctaText" = EXCLUDED."ctaText",
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    "homeUrl" = EXCLUDED."homeUrl",
    "brandColor" = EXCLUDED."brandColor",
    guarantees = EXCLUDED.guarantees,
    "publishedAt" = EXCLUDED."publishedAt",
    "updatedAt" = NOW();
    
  RAISE NOTICE 'LandingTenant record created/updated for Wealden Joinery (ID: %)', v_tenant_id;
END $$;
