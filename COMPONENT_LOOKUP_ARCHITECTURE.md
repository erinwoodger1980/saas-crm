# Component Lookup & Manufacturing Architecture

## Overview
This document outlines the comprehensive architecture for integrating lookup tables, material management, calculated fields, and component-based manufacturing for the fire door system.

## Current State Analysis

### Existing Tables
1. **LippingLookup** - Edge lipping specifications by doorset type
2. **Material** - Raw materials (timber, sheet goods, etc.)
3. **MaterialItem** - Specific material products
4. **GlazingItem** - Glass specifications
5. **DoorCore** - Door core products
6. **LeafStyle** - Door leaf designs
7. **LeafFacing** - Facing materials
8. **FireDoorLineItem** - Massive table with 200+ fields

### Problems to Solve
1. **Dropdown management**: Hard-coded options in code vs. database-driven
2. **Material fragmentation**: Multiple tables for similar concepts
3. **Calculation complexity**: Limited formula system
4. **Component relationships**: No product type → component linkage
5. **No BOM generation**: Can't create purchase orders or cut lists
6. **No 3D data**: Missing profiles, positions, dimensions for modeling

## Proposed Architecture

### 1. Component Lookup System

```prisma
model ComponentLookup {
  id                String              @id @default(cuid())
  tenantId          String
  componentType     ComponentType       // LIPPING, CORE, FACING, IRONMONGERY, GLAZING, TIMBER, etc.
  code              String              // Unique code within tenant/type
  name              String
  description       String?
  
  // Pricing
  unitCost          Decimal             @default(0)
  currency          String              @default("GBP")
  unit              String              @default("m")  // m, m2, m3, ea, kg
  
  // Supplier & Availability
  supplierId        String?
  supplier          Supplier?           @relation(fields: [supplierId], references: [id])
  leadTimeDays      Int?
  minOrderQty       Decimal?
  isActive          Boolean             @default(true)
  
  // Physical Properties (flexible JSON for type-specific properties)
  properties        Json?               // { thickness: 6, width: 100, species: "Oak", grade: "Prime" }
  
  // Calculation & BOM
  calculationFormula String?            // Formula string for dimensions/quantities
  componentProfile   ComponentProfile?  @relation(fields: [profileId], references: [id])
  profileId         String?
  
  // Organization
  category          String?
  sortOrder         Int                 @default(0)
  notes             String?
  
  // Relations
  productTypeLinks  ProductTypeComponent[]
  bomLineItems      BOMLineItem[]
  
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  tenant            Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, componentType, code])
  @@index([tenantId, componentType, isActive])
  @@index([tenantId, supplierId])
}

enum ComponentType {
  LIPPING
  CORE
  FACING
  GLAZING
  IRONMONGERY
  TIMBER_STILE
  TIMBER_RAIL
  TIMBER_MULLION
  TIMBER_TRANSOM
  SEAL
  ADHESIVE
  HARDWARE
  FINISH
  OTHER
}

// Product Type → Component mapping
model ProductTypeComponent {
  id              String          @id @default(cuid())
  tenantId        String
  productType     String          // "STANDARD CONCEALED", "D/A 44", "FD30", etc.
  componentId     String
  component       ComponentLookup @relation(fields: [componentId], references: [id], onDelete: Cascade)
  
  // Position & Quantity rules
  position        String?         // "TOP", "BOTTOM", "HINGE", "LOCK", "ALL_EDGES"
  quantity        String?         // Formula: "1", "2", "${doorHeight} * 2", etc.
  
  // Dimension calculation formulas
  lengthFormula   String?         // "${doorHeight} - 10"
  widthFormula    String?         // "${lippingWidth}"
  thicknessFormula String?        // "6"
  
  // Conditional rules
  condition       String?         // "${doorsetType} === 'D/A 44' && ${masterWidth} > 1000"
  
  priority        Int             @default(0)
  isOptional      Boolean         @default(false)
  
  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, productType, componentId, position])
  @@index([tenantId, productType])
}

// 3D Profile definitions for cut lists and modeling
model ComponentProfile {
  id              String              @id @default(cuid())
  tenantId        String
  name            String
  profileType     ProfileType         // RECTANGLE, L_SHAPE, T_SHAPE, CUSTOM
  
  // Cross-section dimensions (in mm)
  width           Float?
  height          Float?
  thickness       Float?
  
  // For complex profiles
  svgPath         String?             // SVG path for custom shapes
  cncProgram      String?             // CNC program reference
  
  // Machining
  machiningNotes  String?
  
  components      ComponentLookup[]
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
}

enum ProfileType {
  RECTANGLE
  SQUARE
  L_SHAPE
  T_SHAPE
  U_CHANNEL
  CUSTOM
}

// BOM (Bill of Materials) Generation
model BOMLineItem {
  id                String          @id @default(cuid())
  tenantId          String
  fireDoorLineItemId String
  fireDoorLineItem  FireDoorLineItem @relation(fields: [fireDoorLineItemId], references: [id], onDelete: Cascade)
  
  componentId       String
  component         ComponentLookup @relation(fields: [componentId], references: [id])
  
  // Calculated values
  position          String?         // "TOP_LIPPING", "HINGE_STILE", etc.
  quantity          Float
  length            Float?          // in mm
  width             Float?          // in mm
  thickness         Float?          // in mm
  area              Float?          // m2
  volume            Float?          // m3
  weight            Float?          // kg
  
  // Costing
  unitCost          Decimal
  totalCost         Decimal
  wastagePercent    Float           @default(10)
  
  // Ordering
  supplierId        String?
  supplier          Supplier?       @relation(fields: [supplierId], references: [id])
  orderStatus       String?         // NOT_ORDERED, ORDERED, RECEIVED
  orderedDate       DateTime?
  receivedDate      DateTime?
  
  // Cut list
  cutListOrder      Int?
  machiningNotes    String?
  
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, fireDoorLineItemId])
  @@index([tenantId, componentId])
  @@index([tenantId, orderStatus])
}

// Supplier Management
model Supplier {
  id              String              @id @default(cuid())
  tenantId        String
  code            String
  name            String
  contactName     String?
  email           String?
  phone           String?
  address         String?
  
  leadTimeDays    Int?
  minOrderValue   Decimal?
  currency        String              @default("GBP")
  
  paymentTerms    String?
  notes           String?
  isActive        Boolean             @default(true)
  
  components      ComponentLookup[]
  bomLineItems    BOMLineItem[]
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, code])
}
```

### 2. Enhanced Field Calculation System

Update the existing `fireDoorLineItemLayout` JSON to include:

```typescript
interface FieldCalculation {
  formula: string;                    // JavaScript expression
  dependencies: string[];             // Field keys this depends on
  lookupTable?: string;               // Reference to ComponentLookup or other table
  lookupCondition?: string;           // Filter for lookup: "componentType = 'LIPPING' AND code = ${doorsetType}"
  lookupField?: string;               // Field to extract from lookup: "topMm"
  unit?: string;                      // Unit of result
}

interface EnhancedFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'calculated';
  
  // For select fields
  optionsSource?: 'static' | 'lookup' | 'material';
  lookupTable?: string;               // "ComponentLookup", "Material", etc.
  lookupFilter?: string;              // "componentType = 'LIPPING' AND isActive = true"
  lookupDisplayField?: string;        // "name"
  lookupValueField?: string;          // "code" or "id"
  
  // For calculated fields
  calculation?: FieldCalculation;
  
  // Validation
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  
  visible: boolean;
  editable: boolean;
}
```

### 3. Lipping Integration Example

#### Step 1: Configure Lipping Lookup as Component

```typescript
// In settings, create ComponentLookup entries from LippingLookup
const lippingComponents = await prisma.lippingLookup.findMany({
  where: { tenantId, isActive: true }
});

for (const lipping of lippingComponents) {
  await prisma.componentLookup.create({
    data: {
      tenantId,
      componentType: 'LIPPING',
      code: lipping.doorsetType,
      name: `${lipping.doorsetType} Lipping`,
      properties: {
        topMm: lipping.topMm,
        bottomMm: lipping.bottomMm,
        hingeMm: lipping.hingeMm,
        lockMm: lipping.lockMm,
        safeHingeMm: lipping.safeHingeMm,
        daExposedMm: lipping.daExposedMm,
        trimMm: lipping.trimMm,
        postformedMm: lipping.postformedMm,
        extrasMm: lipping.extrasMm
      }
    }
  });
}
```

#### Step 2: Link to Product Types

```sql
-- Create relationships between product types and lipping components
INSERT INTO "ProductTypeComponent" (
  "tenantId", 
  "productType", 
  "componentId",
  "position",
  "lengthFormula",
  "widthFormula"
)
SELECT 
  cl."tenantId",
  cl."code" as "productType",
  cl."id" as "componentId",
  'TOP' as "position",
  '${doorWidth}' as "lengthFormula",
  'JSON_EXTRACT(properties, ''$.topMm'')' as "widthFormula"
FROM "ComponentLookup" cl
WHERE cl."componentType" = 'LIPPING';
```

#### Step 3: Configure Line Item Field

```json
{
  "key": "topLipping",
  "label": "Top Lipping (mm)",
  "type": "calculated",
  "calculation": {
    "formula": "lookupValue",
    "dependencies": ["doorsetType"],
    "lookupTable": "ComponentLookup",
    "lookupCondition": "componentType = 'LIPPING' AND code = ${doorsetType}",
    "lookupField": "properties.topMm",
    "unit": "mm"
  },
  "visible": true,
  "editable": false
}
```

### 4. Material Integration Strategy

**Option A: Migrate to ComponentLookup** (Recommended)
- Move all Material, GlazingItem, DoorCore, etc. into ComponentLookup
- Use `componentType` to differentiate
- Use `properties` JSON for type-specific fields
- Maintain backward compatibility with migration

**Option B: Keep Separate + Link**
- Keep existing Material tables
- Add `linkedMaterialId` to ComponentLookup
- ComponentLookup becomes the "specification" layer
- Material remains the "product catalog" layer

### 5. BOM Generation Flow

```typescript
async function generateBOM(lineItemId: string) {
  const lineItem = await prisma.fireDoorLineItem.findUnique({
    where: { id: lineItemId }
  });
  
  // Get product type components
  const components = await prisma.productTypeComponent.findMany({
    where: {
      tenantId: lineItem.tenantId,
      productType: lineItem.doorsetType
    },
    include: {
      component: {
        include: {
          supplier: true,
          componentProfile: true
        }
      }
    }
  });
  
  const bomItems = [];
  
  for (const ptc of components) {
    // Evaluate condition
    if (ptc.condition) {
      const conditionMet = evaluateFormula(ptc.condition, lineItem);
      if (!conditionMet) continue;
    }
    
    // Calculate dimensions
    const length = evaluateFormula(ptc.lengthFormula, lineItem);
    const width = evaluateFormula(ptc.widthFormula, lineItem);
    const thickness = evaluateFormula(ptc.thicknessFormula, lineItem);
    const quantity = evaluateFormula(ptc.quantity, lineItem);
    
    // Calculate cost
    const totalCost = calculateComponentCost(
      ptc.component,
      quantity,
      length,
      width,
      thickness
    );
    
    bomItems.push({
      fireDoorLineItemId: lineItem.id,
      componentId: ptc.component.id,
      position: ptc.position,
      quantity,
      length,
      width,
      thickness,
      unitCost: ptc.component.unitCost,
      totalCost,
      supplierId: ptc.component.supplierId
    });
  }
  
  // Create BOM line items
  await prisma.bOMLineItem.createMany({
    data: bomItems
  });
  
  return bomItems;
}
```

### 6. Implementation Roadmap

#### Phase 1: Foundation (Week 1)
- [ ] Create ComponentLookup, ProductTypeComponent, ComponentProfile models
- [ ] Create Supplier model
- [ ] Create BOMLineItem model
- [ ] Run migrations

#### Phase 2: Lipping Integration (Week 1-2)
- [ ] Migrate LippingLookup data to ComponentLookup
- [ ] Create ProductTypeComponent relationships
- [ ] Update line item layout to use lookup-driven fields
- [ ] Test lipping calculations

#### Phase 3: Material Consolidation (Week 2-3)
- [ ] Migrate Material → ComponentLookup (TIMBER_* types)
- [ ] Migrate GlazingItem → ComponentLookup (GLAZING type)
- [ ] Migrate DoorCore → ComponentLookup (CORE type)
- [ ] Update all references

#### Phase 4: Enhanced Calculations (Week 3-4)
- [ ] Implement formula evaluator with lookup support
- [ ] Add dropdown field configuration UI
- [ ] Connect dropdowns to ComponentLookup
- [ ] Add field validation

#### Phase 5: BOM Generation (Week 4-5)
- [ ] Implement BOM generation logic
- [ ] Create BOM viewer UI
- [ ] Add supplier management UI
- [ ] Generate purchase orders

#### Phase 6: Cut Lists & 3D (Week 5-6)
- [ ] Create ComponentProfile definitions
- [ ] Generate cut lists from BOM
- [ ] Export data for 3D modeling
- [ ] CNC program integration

## API Endpoints

```typescript
// Component Management
GET    /api/component-lookup                    // List all components
GET    /api/component-lookup/:id                // Get component
POST   /api/component-lookup                    // Create component
PUT    /api/component-lookup/:id                // Update component
DELETE /api/component-lookup/:id                // Delete component

// Product Type Configuration
GET    /api/product-type-components/:productType // Get components for product type
POST   /api/product-type-components             // Link component to product type
PUT    /api/product-type-components/:id         // Update link
DELETE /api/product-type-components/:id         // Remove link

// BOM Generation
POST   /api/fire-door-line-item/:id/generate-bom // Generate BOM for line item
GET    /api/fire-door-line-item/:id/bom         // Get BOM
PUT    /api/bom-line-item/:id                   // Update BOM item
DELETE /api/bom-line-item/:id                   // Remove BOM item

// Purchase Orders
POST   /api/purchase-order                      // Create PO from BOM
GET    /api/purchase-order/:id                  // Get PO
PUT    /api/purchase-order/:id/receive          // Mark items received

// Cut Lists
GET    /api/fire-door-line-item/:id/cut-list   // Generate cut list
POST   /api/cut-list/export                     // Export to CSV/DXF
```

## UI Components

### Settings Pages
1. `/settings/component-lookup` - Manage components (replaces individual material pages)
2. `/settings/product-types` - Configure product type → component relationships
3. `/settings/suppliers` - Supplier management
4. `/settings/calculations` - Formula editor for field calculations

### Production Pages
1. `/fire-door-line-item/:id/bom` - View/edit BOM
2. `/fire-door-line-item/:id/cut-list` - Cut list viewer
3. `/purchase-orders` - PO management
4. `/production/cut-list` - Workshop cut list view

## Benefits

1. **Centralized Component Management**: One table for all components
2. **Flexible Pricing**: Unit-based pricing with wastage calculations
3. **Automated BOM**: Generate BOMs automatically from line items
4. **Supplier Integration**: Track ordering and receiving
5. **Cut List Generation**: Automatic cut lists for workshop
6. **3D Model Ready**: Profile data for 3D modeling
7. **Scalable**: Easy to add new component types
8. **Maintainable**: Formula-driven calculations, not hard-coded logic

## Migration Strategy

1. **Preserve existing data**: Don't delete old tables immediately
2. **Dual-write period**: Write to both old and new tables
3. **Gradual rollout**: Enable new system per tenant
4. **Validation**: Compare old vs. new calculations
5. **Rollback plan**: Can revert to old system if needed
