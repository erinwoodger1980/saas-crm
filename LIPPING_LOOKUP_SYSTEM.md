# Lipping Lookup System

## Overview

The Lipping Lookup System is a foundational component for door manufacturing that manages lipping specifications across different doorset types. It serves as the bedrock for component sizing, material cost calculations, and quote generation in the door configurator.

## Architecture

### Database Schema

**Table:** `LippingLookup`

| Field | Type | Description |
|-------|------|-------------|
| id | String (CUID) | Primary key |
| tenantId | String | Tenant reference (FK) |
| doorsetType | String | Unique doorset type identifier |
| topMm | Int? | Top edge lipping thickness (mm) |
| bottomMm | Int? | Bottom edge lipping thickness (mm) |
| hingeMm | Int? | Hinge side lipping thickness (mm) |
| lockMm | Int? | Lock side lipping thickness (mm) |
| safeHingeMm | Int? | Safe hinge lipping thickness (mm) |
| daExposedMm | Int? | D/A exposed lipping thickness (mm) |
| trimMm | Int? | Trim lipping thickness (mm) |
| postformedMm | Int? | Postformed lipping thickness (mm) |
| extrasMm | Int? | Extra lipping allowance (mm) |
| commentsForNotes | String? | Manufacturing notes |
| isActive | Boolean | Soft delete flag (default: true) |
| sortOrder | Int | Display order (default: 0) |
| createdAt | DateTime | Record creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Constraints:**
- Unique index on `(tenantId, doorsetType)`
- Index on `(tenantId, isActive)`
- Cascade delete on tenant removal

### Default Doorset Types

The system includes 7 standard doorset types pre-seeded from the CSV:

1. **STANDARD CONCEALED** - 8mm all edges, 2mm trim
2. **STANDARD EXPOSED** - 8mm all edges, 2mm trim, 5mm extras (facings applied before lipping)
3. **D/A 44** - 8mm concealed hinge + 8mm exposed lock side, 2mm trim
4. **D/A 54** - 6mm top, 12mm exposed lock side, 8mm hinge, 2mm trim
5. **SAFEHINGE 44** - 7mm top/bottom T-section, 8mm hinge/lock, 8mm safe hinge
6. **SAFEHINGE 54** - 7mm top/bottom T-section, 11mm safe hinge, NO hinge lipping
7. **POSTFORMED 44** - 8mm all edges, 2mm trim, 4mm postformed

## API Endpoints

### Base Path: `/lipping-lookup`

All endpoints require authentication via JWT.

#### GET /lipping-lookup
List all active lipping specifications for the tenant.

**Response:** Array of `LippingLookup` objects

```json
[
  {
    "id": "clx...",
    "tenantId": "clx...",
    "doorsetType": "STANDARD CONCEALED",
    "topMm": 8,
    "bottomMm": 8,
    "hingeMm": 8,
    "lockMm": 8,
    "safeHingeMm": 0,
    "daExposedMm": 0,
    "trimMm": 2,
    "postformedMm": null,
    "extrasMm": null,
    "commentsForNotes": null,
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2025-12-17T...",
    "updatedAt": "2025-12-17T..."
  }
]
```

#### GET /lipping-lookup/:id
Get a specific lipping specification by ID.

**Parameters:**
- `id` - Lipping lookup record ID

**Response:** Single `LippingLookup` object or 404

#### GET /lipping-lookup/type/:doorsetType
Get lipping specification by doorset type name.

**Parameters:**
- `doorsetType` - URL-encoded doorset type (e.g., "STANDARD%20CONCEALED")

**Response:** Single `LippingLookup` object or 404

#### POST /lipping-lookup
Create a new lipping specification.

**Body:**
```json
{
  "doorsetType": "CUSTOM TYPE",
  "topMm": 8,
  "bottomMm": 8,
  "hingeMm": 8,
  "lockMm": 8,
  "safeHingeMm": 0,
  "daExposedMm": 0,
  "trimMm": 2,
  "postformedMm": 4,
  "extrasMm": null,
  "commentsForNotes": "Custom manufacturing notes",
  "sortOrder": 10
}
```

**Response:** Created `LippingLookup` object (201) or error

**Errors:**
- 400: `doorsetType` is required
- 409: Lipping lookup already exists for this doorset type

#### PUT /lipping-lookup/:id
Update an existing lipping specification.

**Parameters:**
- `id` - Lipping lookup record ID

**Body:** Partial `LippingLookup` object (only fields to update)

**Response:** Updated `LippingLookup` object or error

**Errors:**
- 404: Lipping lookup not found
- 409: Another record exists with the new doorsetType

#### DELETE /lipping-lookup/:id
Soft delete a lipping specification (sets `isActive = false`).

**Parameters:**
- `id` - Lipping lookup record ID

**Response:** `{ success: true, message: "Lipping lookup deleted" }`

**Errors:**
- 404: Lipping lookup not found

#### POST /lipping-lookup/calculate
Calculate lipping requirements for given door dimensions.

**Body:**
```json
{
  "doorsetType": "STANDARD CONCEALED",
  "doorWidth": 926,
  "doorHeight": 2040,
  "quantity": 10
}
```

**Response:**
```json
{
  "doorsetType": "STANDARD CONCEALED",
  "perDoor": {
    "topMm": 8,
    "bottomMm": 8,
    "hingeMm": 8,
    "lockMm": 8,
    "safeHingeMm": 0,
    "daExposedMm": 0,
    "trimMm": 2,
    "postformedMm": null,
    "extrasMm": null
  },
  "totalForQuantity": {
    "topLinearMeters": 9.26,
    "bottomLinearMeters": 9.26,
    "hingeLinearMeters": 20.4,
    "lockLinearMeters": 20.4,
    "safeHingeLinearMeters": null,
    "daExposedLinearMeters": null
  },
  "commentsForNotes": null,
  "quantity": 10
}
```

## Frontend Integration

### Settings UI

**Path:** `/settings/lipping-lookup`

Comprehensive management interface featuring:
- Sortable table with all lipping specifications
- Inline editing for quick updates
- Create new doorset types
- Delete (soft delete) specifications
- Visual display of all edge measurements
- Form validation with error messages

**Navigation:** Settings → Lipping Lookup (📐 icon)

### Calculation Utilities

**Location:** `web/src/lib/lipping-calculations.ts`

Core calculation functions for lipping requirements:

```typescript
// Calculate linear meters required per edge
calculateLippingRequirements(lippingSpec: LippingSpec, dimensions: DoorDimensions): LippingMaterialRequirements

// Calculate costs with material pricing
calculateLippingCost(requirements: LippingMaterialRequirements, pricePerLinearMeter: {...}): {...}

// Generate human-readable summary
generateLippingSummary(requirements: LippingMaterialRequirements): string

// Validate specifications
validateLippingSpec(spec: LippingSpec): { valid: boolean; errors: string[]; warnings: string[] }
```

### Integration Hooks

**Location:** `web/src/lib/lipping-integration.ts`

Integration points for configurator and pricing:

```typescript
// Main configurator integration
calculateDoorLippingCost(doorSpec: ConfiguratorDoorSpec, pricingContext?: LippingPricingContext): Promise<{...}>

// Batch calculations for quotes
batchCalculateLippingCosts(doorSpecs: ConfiguratorDoorSpec[]): Promise<Array<{...}>>

// Material ordering calculations
calculateLippingMaterialOrder(doorSpecs: ConfiguratorDoorSpec[]): Promise<{...}>

// React hook for components
useLippingCalculator(): { lippingSpecs, isLoading, error, calculateCost }
```

## Integration Points

### Door Configurator

The lipping lookup integrates with the door configurator to automatically:
1. Select appropriate lipping specs based on doorset type
2. Calculate linear meters required for each edge
3. Add lipping costs to door price
4. Generate manufacturing notes

**Example Usage:**
```typescript
import { calculateDoorLippingCost } from '@/lib/lipping-integration';

const doorSpec = {
  doorsetType: 'STANDARD CONCEALED',
  width: 926,
  height: 2040,
  quantity: 10
};

const result = await calculateDoorLippingCost(doorSpec);
// result.totalCost: £XXX
// result.breakdown: [{ edge: 'Top', meters: 9.26, thickness: 8, ... }]
// result.notes: ['Manufacturing notes...']
```

### Material Costs

Integrates with material cost system to:
1. Track lipping material inventory by thickness (mm)
2. Calculate total linear meters needed for orders
3. Apply current material pricing to calculations
4. Generate BOM (Bill of Materials) for production

**Example Usage:**
```typescript
import { calculateLippingMaterialOrder } from '@/lib/lipping-integration';

const order = await calculateLippingMaterialOrder(doorSpecs);
// order.byThickness: { 8: 45.2, 12: 18.6 } // Linear meters by thickness
// order.totalLinearMeters: 63.8
// order.specialRequirements: ['T-SECTION LIPPINGS REQUIRED...']
```

### Quote Generation

Enriches quote line items with lipping calculations:
```typescript
import { enrichQuoteLineItemWithLipping } from '@/lib/lipping-integration';

const enrichedLineItem = enrichQuoteLineItemWithLipping(lineItem, lippingCalculation);
// Adds lipping.cost, lipping.breakdown, lipping.notes to line item
// Updates subtotal to include lipping cost
```

## Deployment

### Migration

The database migration is created and ready:
- **File:** `api/prisma/migrations/20251217113245_add_lipping_lookup_table/migration.sql`
- **Status:** Deployed to production via Render auto-deploy

### Seeding

Default data is seeded automatically when the migration runs:
- **Script:** `api/prisma/seed-lipping-lookup.js`
- **Data:** 7 standard doorset types from CSV
- **Per-tenant:** Each tenant receives all 7 default types

To manually seed (development):
```bash
cd api
node prisma/seed-lipping-lookup.js
```

## Usage Examples

### Create Custom Doorset Type

```typescript
const response = await fetch('/api/lipping-lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    doorsetType: 'FIRE DOOR FD30',
    topMm: 10,
    bottomMm: 10,
    hingeMm: 10,
    lockMm: 10,
    safeHingeMm: 0,
    daExposedMm: 0,
    trimMm: 3,
    commentsForNotes: '30-minute fire rating requires 10mm intumescent lipping'
  })
});
```

### Calculate Material Requirements

```typescript
import { useLippingCalculator } from '@/lib/lipping-integration';

function DoorConfigurator() {
  const { lippingSpecs, calculateCost } = useLippingCalculator();
  
  const handleCalculate = async () => {
    const result = await calculateCost({
      doorsetType: 'STANDARD CONCEALED',
      width: 926,
      height: 2040,
      quantity: 5
    });
    
    console.log('Total lipping cost:', result.totalCost);
    console.log('Material breakdown:', result.breakdown);
    console.log('Manufacturing notes:', result.notes);
  };
  
  return <button onClick={handleCalculate}>Calculate</button>;
}
```

## Best Practices

1. **Doorset Type Naming:** Use descriptive, uppercase names (e.g., "STANDARD CONCEALED", "SAFEHINGE 44")
2. **Comments:** Include manufacturing requirements that affect process/timing
3. **Validation:** Always validate specs before saving (use `validateLippingSpec`)
4. **Material Pricing:** Keep material costs up-to-date for accurate quote generation
5. **Per-Tenant:** Each tenant can customize their lipping specs independently

## Future Enhancements

- [ ] Import/export lipping specifications (CSV, JSON)
- [ ] Duplicate doorset types for quick customization
- [ ] Lipping material inventory tracking integration
- [ ] Historical pricing analysis
- [ ] Visual lipping diagram generator
- [ ] Integration with CAD/CAM systems
- [ ] Multi-currency support for international tenants
- [ ] Waste calculation and optimization

## Support

For questions or issues with the lipping lookup system:
1. Check API endpoint responses for detailed error messages
2. Validate lipping specs using `validateLippingSpec()`
3. Review calculation utilities documentation
4. Contact development team for integration support

---

**Last Updated:** 17 December 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
