# Fire Door Component System Setup Guide

## Overview

This guide walks you through setting up the global component system for your fire door manufacturing business. Once complete, you'll have:

- ✅ Database-driven component library (lippings, hinges, locks, seals, etc.)
- ✅ Automatic BOM generation from fire door schedules
- ✅ Component ordering and receiving workflow
- ✅ Supplier management with lead times
- ✅ Formula-based quantity calculations

## Phase 1: Run the Database Migration

### Step 1: Apply Migration to Production

The migration is already created at `api/prisma/migrations/20251217132728_add_global_component_system/migration.sql`

**Option A: Via Prisma CLI (if shadow database works)**
```bash
cd /Users/Erin/saas-crm/api
pnpm prisma migrate deploy
```

**Option B: Manual SQL Execution (if shadow database has issues)**
```bash
# Connect to your production database
psql "postgresql://joineryai_db_user:PASSWORD@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require"

# Run the migration file
\i api/prisma/migrations/20251217132728_add_global_component_system/migration.sql
```

**Option C: Via Render Dashboard**
1. Go to your Render database dashboard
2. Open the "Query" tab
3. Copy/paste the contents of the migration SQL file
4. Execute

### Step 2: Verify Migration
```sql
-- Check that tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ComponentLookup', 'ProductTypeComponent', 'ComponentProfile', 'Project', 'BOMLineItem');

-- Should return 5 rows
```

## Phase 2: Migrate Existing Lipping Data

### Step 3: Convert LippingLookup to ComponentLookup

Create a migration script to move your existing lipping data:

```sql
-- Migrate existing lipping lookup data to ComponentLookup
INSERT INTO "ComponentLookup" (
  "id",
  "tenantId",
  "productTypes",
  "componentType",
  "code",
  "name",
  "description",
  "unitOfMeasure",
  "basePrice",
  "leadTimeDays",
  "supplierId",
  "isActive",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT 
  gen_random_uuid() as id,
  "tenantId",
  ARRAY['FIRE_DOOR', 'FIRE_DOOR_SET']::TEXT[] as "productTypes",
  'LIPPING' as "componentType",
  'LIP-' || "doorsetType" as code,
  "doorsetType" || ' Lipping' as name,
  "commentsForNotes" as description,
  'MM' as "unitOfMeasure",
  0 as "basePrice",
  0 as "leadTimeDays",
  NULL as "supplierId",
  "isActive",
  jsonb_build_object(
    'doorsetType', "doorsetType",
    'topMm', "topMm",
    'bottomMm', "bottomMm",
    'hingeMm', "hingeMm",
    'lockMm', "lockMm",
    'safeHingeMm', "safeHingeMm",
    'daExposedMm', "daExposedMm",
    'trimMm', "trimMm",
    'postformedMm', "postformedMm",
    'extrasMm', "extrasMm"
  ) as metadata,
  "createdAt",
  "updatedAt"
FROM "LippingLookup"
WHERE "isActive" = true;

-- Verify migration
SELECT COUNT(*) FROM "ComponentLookup" WHERE "componentType" = 'LIPPING';
```

## Phase 3: Define Product Type Components

### Step 4: Configure Fire Door Components

Define which components fire doors need:

```sql
-- Define component types for fire doors
INSERT INTO "ProductTypeComponent" ("id", "tenantId", "productType", "componentType", "displayName", "isRequired", "sortOrder", "formulaEnabled", "createdAt", "updatedAt")
VALUES
  -- Lipping (already migrated above)
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'LIPPING', 'Door Lipping', true, 1, false, NOW(), NOW()),
  
  -- Seals & Strips
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'INTUMESCENT_STRIP', 'Intumescent Strip', true, 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'SMOKE_SEAL', 'Smoke Seal', false, 3, true, NOW(), NOW()),
  
  -- Hardware
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'HINGE', 'Hinges', true, 4, false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'LOCK', 'Lock/Latch', true, 5, false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'DOOR_CLOSER', 'Door Closer', false, 6, false, NOW(), NOW()),
  
  -- Glazing
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'VISION_PANEL', 'Vision Panel/Glass', false, 7, false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'GLAZING_BEAD', 'Glazing Bead', false, 8, true, NOW(), NOW()),
  
  -- Core Materials
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'DOOR_BLANK', 'Door Blank/Core', true, 9, false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'FACING', 'Door Facing', true, 10, false, NOW(), NOW()),
  
  -- Frame
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'FRAME', 'Door Frame', false, 11, false, NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'THRESHOLD', 'Threshold', false, 12, false, NOW(), NOW()),
  
  -- Finish
  (gen_random_uuid(), 'YOUR_TENANT_ID', 'FIRE_DOOR', 'PAINT_FINISH', 'Paint/Finish', false, 13, false, NOW(), NOW());

-- Replace 'YOUR_TENANT_ID' with your actual tenant ID
-- Find it with: SELECT id, name FROM "Tenant" LIMIT 1;
```

## Phase 4: Populate Component Library

### Step 5: Add Common Fire Door Components

Add your standard components to the library:

```sql
-- Example: Intumescent Strips
INSERT INTO "ComponentLookup" ("id", "tenantId", "productTypes", "componentType", "code", "name", "description", "unitOfMeasure", "basePrice", "leadTimeDays", "isActive", "metadata", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR', 'FIRE_DOOR_SET'], 'INTUMESCENT_STRIP', 'INT-15MM', 'Intumescent Strip 15mm', 'Standard 15mm intumescent strip', 'M', 2.50, 7, true, '{"width": "15mm", "material": "Graphite"}', NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR', 'FIRE_DOOR_SET'], 'INTUMESCENT_STRIP', 'INT-20MM', 'Intumescent Strip 20mm', 'Heavy duty 20mm intumescent strip', 'M', 3.25, 7, true, '{"width": "20mm", "material": "Graphite"}', NOW(), NOW());

-- Example: Hinges
INSERT INTO "ComponentLookup" ("id", "tenantId", "productTypes", "componentType", "code", "name", "description", "unitOfMeasure", "basePrice", "leadTimeDays", "isActive", "metadata", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'HINGE', 'HNG-BT-SS', 'Ball Bearing Hinge Stainless Steel', '4" ball bearing fire rated hinge', 'EA', 12.50, 5, true, '{"size": "4inch", "finish": "Stainless Steel", "fireRated": true}', NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'HINGE', 'HNG-BT-PSS', 'Ball Bearing Hinge Polished SS', '4" ball bearing hinge polished', 'EA', 15.00, 5, true, '{"size": "4inch", "finish": "Polished Stainless", "fireRated": true}', NOW(), NOW());

-- Example: Locks
INSERT INTO "ComponentLookup" ("id", "tenantId", "productTypes", "componentType", "code", "name", "description", "unitOfMeasure", "basePrice", "leadTimeDays", "isActive", "metadata", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'LOCK', 'LOCK-SL-SS', 'Sash Lock Stainless Steel', 'Standard sash lock fire rated', 'EA', 18.50, 5, true, '{"type": "Sash Lock", "finish": "Stainless Steel", "fireRated": true}', NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'LOCK', 'LOCK-PANIC', 'Panic Hardware', 'Exit panic hardware', 'EA', 125.00, 14, true, '{"type": "Panic Bar", "fireRated": true}', NOW(), NOW());

-- Example: Door Closers
INSERT INTO "ComponentLookup" ("id", "tenantId", "productTypes", "componentType", "code", "name", "description", "unitOfMeasure", "basePrice", "leadTimeDays", "isActive", "metadata", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'DOOR_CLOSER', 'CLO-OH-STD', 'Overhead Door Closer Standard', 'Size 3-4 overhead closer', 'EA', 45.00, 7, true, '{"size": "3-4", "type": "Overhead"}', NOW(), NOW()),
  (gen_random_uuid(), 'YOUR_TENANT_ID', ARRAY['FIRE_DOOR'], 'DOOR_CLOSER', 'CLO-CON', 'Concealed Door Closer', 'Concealed closer for fire doors', 'EA', 85.00, 14, true, '{"type": "Concealed"}', NOW(), NOW());

-- Add more components as needed...
```

### Step 6: Set Up Suppliers (Optional)

Link components to suppliers for better tracking:

```sql
-- Update existing suppliers with component preferences
UPDATE "Supplier"
SET 
  "leadTimeDays" = 7,
  "preferredForTypes" = ARRAY['HINGE', 'LOCK', 'DOOR_CLOSER']
WHERE "name" ILIKE '%ironmongery%' OR "name" ILIKE '%hardware%';

UPDATE "Supplier"
SET 
  "leadTimeDays" = 5,
  "preferredForTypes" = ARRAY['INTUMESCENT_STRIP', 'SMOKE_SEAL']
WHERE "name" ILIKE '%seal%' OR "name" ILIKE '%strip%';

-- Link components to suppliers
UPDATE "ComponentLookup"
SET "supplierId" = (SELECT "id" FROM "Supplier" WHERE "name" ILIKE '%ironmongery%' LIMIT 1)
WHERE "componentType" IN ('HINGE', 'LOCK', 'DOOR_CLOSER');
```

## Phase 5: Create Component Management UI

### Step 7: Add Component Library Page

Create `/web/src/app/settings/components/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash } from "lucide-react";

interface Component {
  id: string;
  code: string;
  name: string;
  componentType: string;
  productTypes: string[];
  unitOfMeasure: string;
  basePrice: number;
  leadTimeDays: number;
  isActive: boolean;
}

export default function ComponentsPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    try {
      const data = await apiFetch("/api/components");
      setComponents(data);
    } catch (err) {
      console.error("Failed to load components:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Component Library</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Component
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Products</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Lead Time</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{component.code}</td>
                <td className="px-4 py-3">{component.name}</td>
                <td className="px-4 py-3">{component.componentType}</td>
                <td className="px-4 py-3">{component.productTypes.join(", ")}</td>
                <td className="px-4 py-3">£{component.basePrice.toFixed(2)}</td>
                <td className="px-4 py-3">{component.leadTimeDays} days</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Step 8: Create API Endpoints

Create `/api/src/routes/components.ts`:

```typescript
import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/components - List all components
router.get("/components", requireAuth, async (req, res) => {
  try {
    const components = await prisma.componentLookup.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { supplier: true },
      orderBy: [{ componentType: "asc" }, { code: "asc" }],
    });
    res.json(components);
  } catch (error) {
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components" });
  }
});

// POST /api/components - Create component
router.post("/components", requireAuth, async (req, res) => {
  try {
    const component = await prisma.componentLookup.create({
      data: {
        ...req.body,
        tenantId: req.user!.tenantId,
      },
    });
    res.json(component);
  } catch (error) {
    console.error("Error creating component:", error);
    res.status(500).json({ error: "Failed to create component" });
  }
});

// PUT /api/components/:id - Update component
router.put("/components/:id", requireAuth, async (req, res) => {
  try {
    const component = await prisma.componentLookup.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(component);
  } catch (error) {
    console.error("Error updating component:", error);
    res.status(500).json({ error: "Failed to update component" });
  }
});

export default router;
```

Don't forget to register the routes in your main API file:
```typescript
import componentsRouter from "./routes/components";
app.use("/api", componentsRouter);
```

## Phase 6: Integrate with Fire Door Schedule

### Step 9: Add Component Selectors to Fire Door Schedule

Add component dropdowns to replace hardcoded fields in `/web/src/app/fire-door-schedule/[id]/page.tsx`:

```typescript
// Add this to fetch available components
const [lippingComponents, setLippingComponents] = useState<Component[]>([]);

useEffect(() => {
  async function loadComponents() {
    const components = await apiFetch("/api/components");
    setLippingComponents(components.filter(c => c.componentType === 'LIPPING'));
  }
  loadComponents();
}, []);

// Replace lipping dropdown with component selector
<select
  value={project.lippingCode || ''}
  onChange={(e) => {
    const component = lippingComponents.find(c => c.code === e.target.value);
    updateProject({
      lippingCode: e.target.value,
      lippingPrice: component?.basePrice || 0,
    });
  }}
>
  <option value="">Select Lipping...</option>
  {lippingComponents.map(c => (
    <option key={c.id} value={c.code}>
      {c.name} - £{c.basePrice.toFixed(2)}
    </option>
  ))}
</select>
```

### Step 10: Add BOM Generation

Add a "Generate BOM" button to fire door schedule detail page:

```typescript
async function generateBOM(projectId: string) {
  try {
    // Create Project wrapper
    const project = await apiFetch(`/api/projects`, {
      method: 'POST',
      body: JSON.stringify({
        projectType: 'FIRE_DOOR_SCHEDULE',
        fireDoorScheduleId: projectId,
        projectName: fireDoorProject.jobName,
        referenceNumber: fireDoorProject.mjsNumber,
      }),
    });

    // Generate BOM items based on project data
    const bomItems = [];
    
    // Add lipping if selected
    if (fireDoorProject.lippingCode) {
      bomItems.push({
        componentLookupId: fireDoorProject.lippingCode,
        componentType: 'LIPPING',
        quantity: calculateLippingQuantity(fireDoorProject), // Your calculation logic
        status: 'DRAFT',
      });
    }

    // Add hinges (3 per door standard)
    if (fireDoorProject.hingeCode) {
      bomItems.push({
        componentLookupId: fireDoorProject.hingeCode,
        componentType: 'HINGE',
        quantity: (fireDoorProject.doorSets || 1) * 3,
        status: 'DRAFT',
      });
    }

    // Create BOM line items
    await apiFetch(`/api/projects/${project.id}/bom`, {
      method: 'POST',
      body: JSON.stringify({ items: bomItems }),
    });

    alert('BOM generated successfully!');
  } catch (error) {
    console.error('Error generating BOM:', error);
    alert('Failed to generate BOM');
  }
}
```

## Summary

You now have:

1. ✅ **Database tables** - ComponentLookup, ProductTypeComponent, Project, BOMLineItem
2. ✅ **Migrated data** - Existing lipping lookup data converted to components
3. ✅ **Component library** - Defined component types for fire doors
4. ✅ **Populated catalog** - Sample components (hinges, locks, seals, etc.)
5. ✅ **Management UI** - Settings page to manage components
6. ✅ **API endpoints** - CRUD operations for components
7. ✅ **Fire door integration** - Component selectors and BOM generation

## Next Steps

1. **Bulk import** - Create CSV import for large component catalogs
2. **Formula system** - Add calculated quantity fields (perimeter for strips, etc.)
3. **Ordering workflow** - UI for marking BOM items as ordered/received
4. **Purchase orders** - Generate POs grouped by supplier
5. **Cut lists** - Generate cutting schedules from BOM
6. **3D profiles** - Add ComponentProfile data for visualization

## Need Help?

Common issues:
- **Migration fails**: Check database permissions, try manual SQL execution
- **Components not showing**: Verify tenantId matches in all queries
- **BOM generation errors**: Check that Project and ComponentLookup IDs are valid

The system is designed to be flexible - you can add custom component types, product types, and metadata fields without code changes!
