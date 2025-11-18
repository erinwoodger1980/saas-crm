# Door Pricing Engine Guide

Complete pricing system for door manufacturing, converting geometry/dimensions into costed material requirements with labour, overhead, and margin calculations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (src/lib/costing)                │
│  ┌──────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ dimensions.ts    │  │ apertures.ts    │  │ engine.ts   ││
│  │ (geometry calc)  │→ │ (glass calc)    │→ │(orchestrator││
│  └──────────────────┘  └─────────────────┘  └──────┬──────┘│
└────────────────────────────────────────────────────┼────────┘
                                                      │
                                           DoorCostingContext
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend (api/src/lib)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              door-pricing-engine.ts                  │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ 1. buildMaterialRequirements                 │   │   │
│  │  │    (pure: context → materials list)          │   │   │
│  │  └──────────────────┬───────────────────────────┘   │   │
│  │                     │                                │   │
│  │  ┌──────────────────▼───────────────────────────┐   │   │
│  │  │ 2. priceMaterialRequirementsForTenant        │   │   │
│  │  │    (DB: lookup MaterialItem costs)           │   │   │
│  │  └──────────────────┬───────────────────────────┘   │   │
│  │                     │                                │   │
│  │  ┌──────────────────▼───────────────────────────┐   │   │
│  │  │ 3. priceDoorLine                             │   │   │
│  │  │    (orchestrate + add labour/overhead/margin)│   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Dependencies: Prisma (MaterialItem queries)                │
└──────────────────────────────────────────────────────────────┘
```

## File Locations

**Frontend costing modules** (pure geometry/dimensions):
- `/src/lib/costing/derived-dimensions.ts` - Core dimensions, leaf sizing
- `/src/lib/costing/apertures-and-glass.ts` - Vision panel/glass calculations  
- `/src/lib/costing/door-costing-engine.ts` - Orchestrator (combines dimensions + apertures)

**Backend pricing module** (database-backed pricing):
- `/api/src/lib/door-pricing-engine.ts` - **NEW** Material requirements → costed breakdown

**Database schema**:
- `/api/prisma/schema.prisma` - MaterialItem model (tenant-scoped material pricing)

## Core Types

### MaterialRequirement (Unpiced)

```typescript
interface MaterialRequirement {
  category: "door_blank" | "core" | "lipping" | "timber" | "glass" | "ironmongery" | "finish" | "other";
  description: string;
  materialCode?: string;        // Preferred code for MaterialItem lookup
  quantity: number;              // Already multiplied by door qty
  unit: "m" | "m2" | "m3" | "each";
  meta?: {
    fireRating?: string | null;
    glassType?: string | null;
    thicknessMm?: number | null;
    // ... other hints for material lookup
  };
}
```

### PricedMaterialRequirement (With Costs)

```typescript
interface PricedMaterialRequirement extends MaterialRequirement {
  materialItemId?: string | null;  // null if no match found
  costPerUnit: number;              // 0 if no match
  sellPerUnit: number;              // 0 if no match
  lineCost: number;                 // costPerUnit × quantity
  lineSell: number;                 // sellPerUnit × quantity
}
```

### DoorLinePriceBreakdown (Complete)

```typescript
interface DoorLinePriceBreakdown {
  context: DoorCostingContext;     // Original geometry/dimensions
  materials: PricedMaterialRequirement[];
  materialCostTotal: number;
  materialSellTotal: number;
  labourCost: number;
  overheadCost: number;
  preMarginSell: number;
  marginAmount: number;
  marginPercent: number;
  finalSellPrice: number;          // Customer-facing price
}
```

### PricingConfig (Business Rules)

```typescript
interface PricingConfig {
  defaultLabourCostPerDoor: number;       // e.g. £50 per door
  defaultOverheadPercentOnCost: number;   // e.g. 15% of (materials + labour)
  targetMarginPercentOnSell: number;      // e.g. 25% gross margin
  defaultMaterialMarkupPercent?: number;  // e.g. 30% if no explicit sell price
}
```

## Key Functions

### 1. buildMaterialRequirements()

**Pure function** - converts door geometry into material list (no database access).

```typescript
function buildMaterialRequirements(context: DoorCostingContext): MaterialRequirement[]
```

**Calculates quantities for**:
- **Core sheets**: `(coreWidthMm × coreHeightMm / 1,000,000) × qty` → m²
- **Lipping**: `2 × (leafWidth + leafHeight) / 1000 × leaves × qty` → m
- **Frame timber**: `perimeter × crossSection × qty` → m³
- **Glass**: `apertures.totalGlassAreaM2 × qty` → m²
- **Ironmongery pack**: `qty` → each
- **Door blank**: `qty` → each (complete assemblies only)

**Example**:
```typescript
const requirements = buildMaterialRequirements(costingContext);
// [
//   { category: "core", description: "Particleboard core", quantity: 3.6, unit: "m2", ... },
//   { category: "lipping", description: "Door lipping material", quantity: 12.8, unit: "m", ... },
//   { category: "glass", description: "Fire glass", quantity: 0.5, unit: "m2", ... },
//   { category: "ironmongery", description: "Ironmongery pack", quantity: 2, unit: "each", ... }
// ]
```

### 2. priceMaterialRequirementsForTenant()

**Database function** - looks up MaterialItem costs for each requirement.

```typescript
async function priceMaterialRequirementsForTenant(
  tenantId: string,
  requirements: MaterialRequirement[],
  prisma: PrismaClient
): Promise<PricedMaterialRequirement[]>
```

**Lookup strategy**:
1. **Exact code match**: `WHERE code = req.materialCode AND tenantId = ...`
2. **Category fallback**: `WHERE category = map[req.category] AND tenantId = ...`
3. **Not found**: Sets `costPerUnit = 0`, `materialItemId = null` (flags for UI)

**Category mapping**:
```typescript
{
  "door_blank" → "DOOR_BLANK",
  "core"       → "BOARD",
  "lipping"    → "LIPPING",
  "timber"     → "TIMBER",
  "glass"      → "GLASS",
  "ironmongery" → "IRONMONGERY",
  "finish"     → "FINISH",
  "other"      → "OTHER"
}
```

**Pricing logic**:
- `costPerUnit = Number(materialItem.cost)`
- `sellPerUnit = costPerUnit × (1 + defaultMarkup)` (30% default)
- `lineCost = costPerUnit × quantity`
- `lineSell = sellPerUnit × quantity`

**Example**:
```typescript
const priced = await priceMaterialRequirementsForTenant(tenantId, requirements, prisma);
// [
//   { ...requirements[0], materialItemId: "abc123", costPerUnit: 25.00, lineCost: 90.00, ... },
//   { ...requirements[1], materialItemId: null, costPerUnit: 0, lineCost: 0, ... }  ← Missing!
// ]
```

### 3. priceDoorLine()

**Orchestration function** - complete pricing pipeline with labour, overhead, margin.

```typescript
async function priceDoorLine(
  tenantId: string,
  context: DoorCostingContext,
  prisma: PrismaClient,
  config: PricingConfig
): Promise<DoorLinePriceBreakdown>
```

**Pipeline steps**:
1. Build material requirements (pure)
2. Price materials (database lookup)
3. Sum material costs: `Σ lineCost`, `Σ lineSell`
4. Add labour: `config.defaultLabourCostPerDoor × qty`
5. Add overhead: `(materialCost + labour) × (config.overheadPercent / 100)`
6. Calculate margin: `finalSell = totalCost / (1 - targetMargin/100)`
7. Package complete breakdown

**Formula**:
```
Total Cost      = Materials + Labour + Overhead
Final Sell      = Total Cost / (1 - Target Margin %)
Margin Amount   = Final Sell - Total Cost
Margin Percent  = (Margin Amount / Final Sell) × 100
```

**Example**:
```typescript
const config = createDefaultPricingConfig(); // £50 labour, 15% overhead, 25% margin
const breakdown = await priceDoorLine(tenantId, costingContext, prisma, config);

// {
//   materialCostTotal: 250.00,
//   labourCost: 100.00,           // £50 × 2 doors
//   overheadCost: 52.50,          // (250 + 100) × 0.15
//   marginAmount: 134.00,
//   finalSellPrice: 536.00        // (250 + 100 + 52.50) / (1 - 0.25)
// }
```

## Helper Functions

### createDefaultPricingConfig()

```typescript
function createDefaultPricingConfig(): PricingConfig
```

Returns sensible UK joinery defaults:
- `defaultLabourCostPerDoor: 50` (£50 per door)
- `defaultOverheadPercentOnCost: 15` (15% overhead)
- `targetMarginPercentOnSell: 25` (25% gross margin)
- `defaultMaterialMarkupPercent: 30` (30% material markup)

### allMaterialsPriced()

```typescript
function allMaterialsPriced(breakdown: DoorLinePriceBreakdown): boolean
```

Returns `false` if any material has `materialItemId = null`. Use for validation before submitting quotes.

### getUnpricedMaterials()

```typescript
function getUnpricedMaterials(breakdown: DoorLinePriceBreakdown): PricedMaterialRequirement[]
```

Returns materials that couldn't be matched to tenant's MaterialItem database. UI can prompt user to add missing materials.

### formatPriceBreakdown()

```typescript
function formatPriceBreakdown(breakdown: DoorLinePriceBreakdown): string
```

Returns human-readable multi-line summary:
```
=== Door Line Price Breakdown ===
Quantity: 2

Materials:
  Particleboard core: 3.60 m2 @ £25.00 = £90.00
  Door lipping material: 12.80 m @ £8.50 = £108.80
  Fire glass: 0.50 m2 @ £120.00 = £60.00
  Ironmongery pack: 2.00 each @ £45.00 = £90.00
Material Total: £348.80

Labour: £100.00
Overhead: £67.32
Margin (25.0%): £172.04

FINAL SELL PRICE: £688.16
```

## Usage Examples

### Basic Quote Line Pricing

```typescript
import { priceDoorLine, createDefaultPricingConfig, formatPriceBreakdown } from '../lib/door-pricing-engine';
import { calculateDoorCostingContext } from '../../../src/lib/costing/door-costing-engine';
import { SampleDimensionRules } from '../../../src/lib/costing/sample-rules';
import { SampleApertureRules } from '../../../src/lib/costing/sample-aperture-rules';
import { prisma } from '../prisma';

// 1. Get door geometry/dimensions from frontend costing engine
const input = {
  quantity: 2,
  leafConfiguration: "Single Leaf + Frame",
  frameWidthMm: 926,
  frameHeightMm: 2040,
  numberOfLeaves: 1,
  coreType: "Particleboard",
  coreThicknessMm: 44,
  lippingMaterialSelected: true,
  fireRating: "FD30",
  // ... more input fields
};

const dimensionRules = new SampleDimensionRules();
const apertureRules = new SampleApertureRules();
const costingContext = calculateDoorCostingContext(
  input,
  { dimensions: dimensionRules, apertures: apertureRules }
);

// 2. Price the door line
const config = createDefaultPricingConfig();
const breakdown = await priceDoorLine(tenantId, costingContext, prisma, config);

// 3. Display results
console.log(formatPriceBreakdown(breakdown));
console.log(`Final sell: £${breakdown.finalSellPrice.toFixed(2)}`);
console.log(`Margin: ${breakdown.marginPercent.toFixed(1)}%`);
```

### Validation with Missing Materials

```typescript
import { priceDoorLine, allMaterialsPriced, getUnpricedMaterials } from '../lib/door-pricing-engine';

const breakdown = await priceDoorLine(tenantId, costingContext, prisma, config);

if (!allMaterialsPriced(breakdown)) {
  const missing = getUnpricedMaterials(breakdown);
  
  console.warn('Missing materials in database:');
  missing.forEach(m => {
    console.warn(`  - ${m.description} (category: ${m.category}, code: ${m.materialCode})`);
  });
  
  // Prompt user to add materials or return validation error
  throw new Error(`Cannot price quote: ${missing.length} materials not found in database`);
}

// All materials priced - safe to proceed
await saveQuoteLine(breakdown);
```

### Custom Pricing Configuration

```typescript
// High-end custom joinery pricing
const premiumConfig: PricingConfig = {
  defaultLabourCostPerDoor: 150,       // £150 labour (bespoke work)
  defaultOverheadPercentOnCost: 20,    // 20% overhead (workshop + admin)
  targetMarginPercentOnSell: 35,       // 35% margin (premium positioning)
  defaultMaterialMarkupPercent: 50,    // 50% material markup (high-spec)
};

const breakdown = await priceDoorLine(tenantId, context, prisma, premiumConfig);

// Budget/trade pricing
const tradeConfig: PricingConfig = {
  defaultLabourCostPerDoor: 30,        // £30 labour (efficient batch work)
  defaultOverheadPercentOnCost: 10,    // 10% overhead (lean operation)
  targetMarginPercentOnSell: 15,       // 15% margin (competitive trade pricing)
  defaultMaterialMarkupPercent: 20,    // 20% material markup
};
```

### API Route Integration

```typescript
// POST /api/quotes/:id/price-line
router.post('/:quoteId/price-line', async (req, res) => {
  const auth = (req as any).auth;
  if (!auth?.tenantId) return res.status(401).json({ error: 'unauthorized' });
  
  try {
    const { doorInput, pricingConfig } = req.body;
    
    // 1. Calculate geometry
    const costingContext = calculateDoorCostingContext(doorInput, rules);
    
    // 2. Price materials
    const config = pricingConfig || createDefaultPricingConfig();
    const breakdown = await priceDoorLine(auth.tenantId, costingContext, prisma, config);
    
    // 3. Validate all materials found
    if (!allMaterialsPriced(breakdown)) {
      const missing = getUnpricedMaterials(breakdown);
      return res.status(400).json({
        error: 'missing_materials',
        materials: missing.map(m => ({
          category: m.category,
          description: m.description,
          code: m.materialCode
        }))
      });
    }
    
    // 4. Return breakdown
    return res.json({
      breakdown,
      summary: {
        finalSellPrice: breakdown.finalSellPrice,
        marginPercent: breakdown.marginPercent,
        materialCount: breakdown.materials.length
      }
    });
    
  } catch (e: any) {
    console.error('[price-line] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});
```

## Material Quantity Calculations

### Core Sheets
- **Input**: `dimensions.coreWidthMm`, `dimensions.coreHeightMm`
- **Formula**: `(width × height / 1,000,000) × quantity` → m²
- **Example**: 826mm × 1976mm × 2 doors = 3.26 m²

### Lipping
- **Input**: `masterLeafWidthMm`, `leafHeightMm`, `numberOfLeaves`
- **Formula**: `2 × (width + height) / 1000 × leaves × quantity` → m
- **Example**: 2×(826+2040)/1000 × 1 × 2 = 11.5 m

### Frame Timber
- **Input**: `frameWidthMm`, `frameHeightMm`, `frameThicknessMm`
- **Formula**: `perimeter × crossSection × quantity` → m³
- **Approximation**: Uses 100mm depth for cross-section
- **Example**: 2×(926+2040)/1000 × (55×100/1M) × 2 = 0.00652 m³

### Glass
- **Input**: `apertures.totalGlassAreaM2`
- **Formula**: `totalGlassAreaM2 × quantity` → m²
- **Example**: 0.25 m² × 2 doors = 0.5 m²

### Ironmongery
- **Input**: `quantity`
- **Formula**: `quantity` → each
- **Example**: 2 doors = 2 packs

## Database Schema Integration

### MaterialItem Model

```prisma
model MaterialItem {
  id                String              @id @default(cuid())
  tenantId          String
  supplierId        String?
  category          MaterialItemCategory  // ENUM
  code              String
  name              String
  description       String?
  cost              Decimal             @default(0)
  currency          String              @default("GBP")
  unit              String              @default("each")  // each, m, m2, kg, etc.
  stockQuantity     Decimal?
  leadTimeDays      Int?
  isActive          Boolean             @default(true)
  
  @@unique([tenantId, code])
  @@index([tenantId, category, isActive])
}

enum MaterialItemCategory {
  DOOR_BLANK
  LIPPING
  IRONMONGERY
  GLASS
  TIMBER
  BOARD      // Used for core sheets
  VENEER
  FINISH
  HARDWARE
  CONSUMABLE
  OTHER
}
```

### Sample MaterialItem Records

```sql
-- Core material
INSERT INTO MaterialItem (tenantId, category, code, name, cost, unit, isActive)
VALUES ('tenant123', 'BOARD', 'PARTICLEBOARD', 'Particleboard Core 44mm', 25.00, 'm2', true);

-- Lipping
INSERT INTO MaterialItem (tenantId, category, code, name, cost, unit, isActive)
VALUES ('tenant123', 'LIPPING', 'LIPPING', 'Hardwood Lipping 10mm', 8.50, 'm', true);

-- Glass
INSERT INTO MaterialItem (tenantId, category, code, name, cost, unit, isActive)
VALUES ('tenant123', 'GLASS', 'FIRE_GLASS', 'Fire Rated Glass 6mm', 120.00, 'm2', true);

-- Ironmongery
INSERT INTO MaterialItem (tenantId, category, code, name, cost, unit, isActive)
VALUES ('tenant123', 'IRONMONGERY', 'IRONMONGERY_PACK', 'Standard Door Pack', 45.00, 'each', true);
```

## Testing Strategy

### Unit Tests (Pure Functions)

```typescript
describe('buildMaterialRequirements', () => {
  it('calculates core sheet area correctly', () => {
    const context = createMockContext({
      coreWidthMm: 826,
      coreHeightMm: 2040,
      quantity: 2
    });
    
    const requirements = buildMaterialRequirements(context);
    const core = requirements.find(r => r.category === 'core');
    
    expect(core).toBeDefined();
    expect(core.quantity).toBeCloseTo(3.37, 2);  // (826×2040/1M)×2
    expect(core.unit).toBe('m2');
  });
  
  it('calculates lipping perimeter correctly', () => {
    // Test lipping linear meter calculation
  });
  
  it('includes glass when vision panels present', () => {
    // Test glass requirement added
  });
  
  it('skips glass when no vision panels', () => {
    // Test glass requirement omitted
  });
});
```

### Integration Tests (Database Access)

```typescript
describe('priceMaterialRequirementsForTenant', () => {
  beforeEach(async () => {
    // Seed test tenant with MaterialItems
    await prisma.materialItem.create({
      data: {
        tenantId: testTenantId,
        category: 'BOARD',
        code: 'CORE_44MM',
        name: 'Test Core',
        cost: 25.00,
        unit: 'm2',
        isActive: true
      }
    });
  });
  
  it('resolves material by exact code match', async () => {
    const requirements = [
      { category: 'core', materialCode: 'CORE_44MM', quantity: 3.5, unit: 'm2' }
    ];
    
    const priced = await priceMaterialRequirementsForTenant(
      testTenantId,
      requirements,
      prisma
    );
    
    expect(priced[0].materialItemId).toBeDefined();
    expect(priced[0].costPerUnit).toBe(25.00);
    expect(priced[0].lineCost).toBeCloseTo(87.50, 2);
  });
  
  it('returns zero cost for missing materials', async () => {
    const requirements = [
      { category: 'core', materialCode: 'NONEXISTENT', quantity: 3.5, unit: 'm2' }
    ];
    
    const priced = await priceMaterialRequirementsForTenant(
      testTenantId,
      requirements,
      prisma
    );
    
    expect(priced[0].materialItemId).toBeNull();
    expect(priced[0].costPerUnit).toBe(0);
    expect(priced[0].lineCost).toBe(0);
  });
  
  it('enforces tenant isolation', async () => {
    // Test can't access other tenant's materials
  });
});
```

### End-to-End Tests

```typescript
describe('priceDoorLine', () => {
  it('produces complete breakdown with correct margin', async () => {
    const config: PricingConfig = {
      defaultLabourCostPerDoor: 50,
      defaultOverheadPercentOnCost: 15,
      targetMarginPercentOnSell: 25,
    };
    
    const breakdown = await priceDoorLine(
      testTenantId,
      mockCostingContext,
      prisma,
      config
    );
    
    // Verify calculations
    const expectedOverhead = (breakdown.materialCostTotal + breakdown.labourCost) * 0.15;
    expect(breakdown.overheadCost).toBeCloseTo(expectedOverhead, 2);
    
    const expectedTotalCost = breakdown.materialCostTotal + breakdown.labourCost + breakdown.overheadCost;
    const expectedFinalSell = expectedTotalCost / (1 - 0.25);
    expect(breakdown.finalSellPrice).toBeCloseTo(expectedFinalSell, 2);
    
    const actualMarginPercent = (breakdown.marginAmount / breakdown.finalSellPrice) * 100;
    expect(actualMarginPercent).toBeCloseTo(25, 1);
  });
});
```

## Future Enhancements

### Granular Material Breakdown
- Separate head/jamb/sill timber quantities
- Individual ironmongery items (hinges, locks, handles)
- Architectural finishes and coatings
- Seals, intumescent strips, smoke seals

### BOM Rules Engine
- Complex door configurations (Dutch doors, borrowed lights)
- Conditional materials based on fire rating
- Waste factors and cutting allowances
- Pack sizes and minimum order quantities

### Supplier Integration
- Multi-supplier pricing comparison
- Quantity break pricing tiers
- Lead time and availability checks
- Preferred supplier selection rules

### Advanced Pricing
- Time-based labour estimation (complex vs. standard)
- Variable overhead based on order size
- Dynamic margin based on customer tier
- Volume discounts for batch orders

### Optimization
- Material waste optimization (sheet cutting patterns)
- Batch costing for multiple doors
- Standard vs. bespoke pricing tiers
- Cost-to-budget variance tracking

## Troubleshooting

### Issue: Materials showing 0 cost

**Cause**: MaterialItem not found in database for tenant

**Solution**:
```typescript
const breakdown = await priceDoorLine(tenantId, context, prisma, config);
const missing = getUnpricedMaterials(breakdown);

if (missing.length > 0) {
  console.log('Add these materials to database:');
  missing.forEach(m => {
    console.log(`  Category: ${m.category}`);
    console.log(`  Code: ${m.materialCode || 'N/A'}`);
    console.log(`  Description: ${m.description}`);
  });
}
```

### Issue: Margin percentage doesn't match target

**Cause**: Rounding errors in floating point arithmetic

**Solution**: Margin calculation uses `cost / (1 - margin%)` formula which is mathematically precise. Small deviations (< 0.1%) are acceptable due to rounding.

### Issue: Cross-compilation error importing DoorCostingContext

**Cause**: TypeScript rootDir restrictions between frontend (src/) and backend (api/src/)

**Solution**: Types are duplicated inline in pricing engine. Keep in sync manually or extract to shared package.

### Issue: Glass quantity zero despite vision panels

**Cause**: `apertures.totalGlassAreaM2` not calculated in costing context

**Solution**: Ensure aperture rules are provided to `calculateDoorCostingContext()` and vision panel inputs are populated.

## Related Documentation

- **[COMPREHENSIVE_ML_REDESIGN.md](./COMPREHENSIVE_ML_REDESIGN.md)** - Door geometry costing system
- **[QUOTE_BUILDER_STAGE2_PLAN.md](./QUOTE_BUILDER_STAGE2_PLAN.md)** - Quote builder integration
- **Prisma Schema**: `api/prisma/schema.prisma` - MaterialItem model

## Contact & Support

For questions or issues:
- Check existing MaterialItem records in database
- Verify DoorCostingContext has all required dimensions
- Test with `createDefaultPricingConfig()` before custom configs
- Use `formatPriceBreakdown()` for debugging calculation steps
