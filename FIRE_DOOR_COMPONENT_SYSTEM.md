# Fire Door Component & BOM System

## Overview
Transform fire door line items (200+ fields from client CSV) into:
1. **Components** - Manufacturable parts (Door Blank, Frame, Hinges, etc.)
2. **Bill of Materials** - Complete list for purchasing/manufacturing
3. **3D Preview Data** - Dimensions and positioning for visualization

## Architecture

### 1. Data Flow

```
Client CSV (200 fields)
    ↓
FireDoorLineItem (database)
    ↓
ComponentGenerator (service layer)
    ↓
ComponentInstance[] (generated components)
    ↓
├─→ BOM Export (manufacturing)
├─→ 3D Preview (visualization)
└─→ Costing (pricing breakdown)
```

### 2. Database Schema

#### ComponentDefinition
Defines component types and how to generate them from line item fields.

```prisma
model ComponentDefinition {
  id          String   @id @default(cuid())
  tenantId    String
  name        String   // "Door Blank", "Frame Jamb", "Hinge"
  category    String   // "MANUFACTURED", "PURCHASED", "ASSEMBLY"
  description String?
  
  // Property mapping - how to extract from line item
  propertyMappings Json // See schema below
  
  // Conditions - when to create this component
  creationRules Json   // See schema below
  
  // For 3D preview
  preview3DTemplate Json?
  
  // For manufacturing
  cncProgramTemplate String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant @relation(fields: [tenantId], references: [id])
  instances   ComponentInstance[]
  
  @@index([tenantId])
}
```

**propertyMappings** structure:
```json
{
  "width": {
    "source": "field",
    "field": "mLeafWidth",
    "type": "number",
    "required": true
  },
  "height": {
    "source": "field",
    "field": "leafHeight",
    "type": "number",
    "required": true
  },
  "material": {
    "source": "lookup",
    "lookupTable": "DoorCorePrices",
    "matchFields": ["coreType", "fireRating"],
    "returnField": "material",
    "type": "string"
  },
  "thickness": {
    "source": "field",
    "field": "leafThickness",
    "type": "number",
    "default": 44
  }
}
```

**creationRules** structure:
```json
{
  "conditions": [
    {
      "field": "doorsetType",
      "operator": "in",
      "values": ["Doorset", "Leaf Only", "Doorset with Fanlight"]
    },
    {
      "field": "numberOfLeaves",
      "operator": ">=",
      "value": 1
    }
  ],
  "quantity": {
    "source": "field",
    "field": "numberOfLeaves"
  }
}
```

#### ComponentInstance
Actual component instances generated from a line item.

```prisma
model ComponentInstance {
  id                    String   @id @default(cuid())
  tenantId              String
  fireDoorLineItemId    String
  definitionId          String
  
  // Computed properties
  properties            Json     // Actual values extracted
  
  // For ordering
  quantity              Int      @default(1)
  unitCost              Decimal? @db.Decimal(10, 2)
  totalCost             Decimal? @db.Decimal(10, 2)
  
  // For manufacturing
  status                String   @default("PENDING") // PENDING, ORDERED, IN_PRODUCTION, COMPLETE
  supplier              String?
  orderReference        String?
  
  // For 3D preview
  position3D            Json?    // {x, y, z, rotation}
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  tenant                Tenant @relation(fields: [tenantId], references: [id])
  lineItem              FireDoorLineItem @relation(fields: [fireDoorLineItemId], references: [id], onDelete: Cascade)
  definition            ComponentDefinition @relation(fields: [definitionId], references: [id])
  
  @@index([tenantId, fireDoorLineItemId])
  @@index([definitionId])
}
```

**properties** example:
```json
{
  "width": 916,
  "height": 2050,
  "thickness": 44,
  "material": "Strebord",
  "finish": "Laminate",
  "finishColor": "Portes Door Collection",
  "coreType": "FD30",
  "lippingMaterial": "Beech",
  "lippingThickness": 8
}
```

### 3. Standard Component Definitions

#### Door Blank
```typescript
{
  name: "Door Blank",
  category: "MANUFACTURED",
  propertyMappings: {
    width: { source: "field", field: "mLeafWidth", type: "number" },
    height: { source: "field", field: "leafHeight", type: "number" },
    thickness: { source: "field", field: "leafThickness", type: "number", default: 44 },
    coreType: { source: "field", field: "coreType", type: "string" },
    fireRating: { source: "field", field: "fireRating", type: "string" },
    material: {
      source: "lookup",
      lookupTable: "DoorCorePrices",
      matchFields: { core: "${coreType}", rating: "${fireRating}" },
      returnField: "material"
    },
    coreCost: {
      source: "lookup",
      lookupTable: "DoorCorePrices",
      matchFields: { core: "${coreType}", rating: "${fireRating}" },
      returnField: "price"
    }
  },
  creationRules: {
    conditions: [
      { field: "doorsetType", operator: "in", values: ["Doorset", "Leaf Only"] }
    ],
    quantity: { source: "field", field: "numberOfLeaves" }
  }
}
```

#### Frame Jamb
```typescript
{
  name: "Frame Jamb",
  category: "MANUFACTURED",
  propertyMappings: {
    length: { source: "field", field: "oFHeight", type: "number" },
    thickness: { source: "field", field: "frameThickness", type: "number" },
    material: { source: "field", field: "frameMaterial", type: "string" },
    profile: { source: "field", field: "jambProfile", type: "string" }
  },
  creationRules: {
    conditions: [
      { field: "doorsetType", operator: "in", values: ["Doorset", "Frame Only"] }
    ],
    quantity: { source: "constant", value: 2 } // Always 2 jambs per frame
  }
}
```

#### Hinge
```typescript
{
  name: "Hinge",
  category: "PURCHASED",
  propertyMappings: {
    type: { source: "field", field: "hingeType", type: "string" },
    finish: { source: "field", field: "hingeFinish", type: "string" },
    configuration: { source: "field", field: "hingeConfiguration", type: "string" },
    unitCost: {
      source: "lookup",
      lookupTable: "IronmongeryPrices",
      matchFields: { type: "${type}" },
      returnField: "price"
    }
  },
  creationRules: {
    conditions: [
      { field: "hingeQty", operator: ">", value: 0 }
    ],
    quantity: { source: "field", field: "hingeQty" }
  }
}
```

#### Vision Panel Glass
```typescript
{
  name: "Vision Panel Glass",
  category: "PURCHASED",
  propertyMappings: {
    width: { source: "field", field: "vp1WidthLeaf1", type: "number" },
    height: { source: "field", field: "vp1HeightLeaf1", type: "number" },
    type: { source: "field", field: "glassType", type: "string" },
    fireRating: { source: "field", field: "fireRating", type: "string" },
    area: { source: "calculated", formula: "${width} * ${height} / 1000000" }, // m²
    unitCostPerM2: {
      source: "lookup",
      lookupTable: "GlassPrices",
      matchFields: { type: "${type}", rating: "${fireRating}" },
      returnField: "pricePerM2"
    },
    totalCost: { source: "calculated", formula: "${area} * ${unitCostPerM2}" }
  },
  creationRules: {
    conditions: [
      { field: "visionQtyLeaf1", operator: ">", value: 0 }
    ],
    quantity: { source: "field", field: "visionQtyLeaf1" }
  }
}
```

### 4. Component Generator Service

```typescript
// api/src/services/componentGenerator.ts

interface GenerateComponentsOptions {
  lineItemId: string;
  tenantId: string;
  forceRegenerate?: boolean;
}

class ComponentGeneratorService {
  async generateComponents(options: GenerateComponentsOptions) {
    const { lineItemId, tenantId, forceRegenerate } = options;
    
    // 1. Load line item with all fields
    const lineItem = await prisma.fireDoorLineItem.findUnique({
      where: { id: lineItemId }
    });
    
    // 2. Get all component definitions for tenant
    const definitions = await prisma.componentDefinition.findMany({
      where: { tenantId }
    });
    
    // 3. Delete existing components if regenerating
    if (forceRegenerate) {
      await prisma.componentInstance.deleteMany({
        where: { fireDoorLineItemId: lineItemId }
      });
    }
    
    // 4. Generate components
    const components: ComponentInstance[] = [];
    
    for (const definition of definitions) {
      // Check creation rules
      if (!this.shouldCreateComponent(definition, lineItem)) {
        continue;
      }
      
      // Calculate quantity
      const quantity = this.calculateQuantity(definition, lineItem);
      
      // Extract properties
      const properties = await this.extractProperties(
        definition.propertyMappings,
        lineItem,
        tenantId
      );
      
      // Calculate costs
      const unitCost = properties.unitCost || properties.coreCost || null;
      const totalCost = unitCost ? unitCost * quantity : null;
      
      // Create component instance
      const component = await prisma.componentInstance.create({
        data: {
          tenantId,
          fireDoorLineItemId: lineItemId,
          definitionId: definition.id,
          properties,
          quantity,
          unitCost,
          totalCost
        }
      });
      
      components.push(component);
    }
    
    return components;
  }
  
  private shouldCreateComponent(
    definition: ComponentDefinition,
    lineItem: any
  ): boolean {
    const rules = definition.creationRules as any;
    if (!rules.conditions) return true;
    
    for (const condition of rules.conditions) {
      const value = lineItem[condition.field];
      
      switch (condition.operator) {
        case "in":
          if (!condition.values.includes(value)) return false;
          break;
        case ">":
          if (!(value > condition.value)) return false;
          break;
        case ">=":
          if (!(value >= condition.value)) return false;
          break;
        case "==":
          if (value !== condition.value) return false;
          break;
      }
    }
    
    return true;
  }
  
  private calculateQuantity(
    definition: ComponentDefinition,
    lineItem: any
  ): number {
    const rules = definition.creationRules as any;
    
    if (rules.quantity.source === "field") {
      return lineItem[rules.quantity.field] || 1;
    }
    
    if (rules.quantity.source === "constant") {
      return rules.quantity.value;
    }
    
    return 1;
  }
  
  private async extractProperties(
    mappings: any,
    lineItem: any,
    tenantId: string
  ): Promise<any> {
    const properties: any = {};
    
    for (const [key, mapping] of Object.entries(mappings as any)) {
      switch (mapping.source) {
        case "field":
          properties[key] = lineItem[mapping.field] ?? mapping.default;
          break;
          
        case "lookup":
          // Execute LOOKUP() to get value
          const lookupValue = await this.executeLookup(
            mapping.lookupTable,
            mapping.matchFields,
            mapping.returnField,
            lineItem,
            tenantId
          );
          properties[key] = lookupValue;
          break;
          
        case "calculated":
          // Evaluate formula with current properties
          properties[key] = this.evaluateFormula(
            mapping.formula,
            { ...properties, ...lineItem }
          );
          break;
          
        case "constant":
          properties[key] = mapping.value;
          break;
      }
    }
    
    return properties;
  }
  
  private async executeLookup(
    tableName: string,
    matchFields: any,
    returnField: string,
    lineItem: any,
    tenantId: string
  ): Promise<any> {
    // Similar to existing LOOKUP() implementation
    const lookupTable = await prisma.lookupTable.findFirst({
      where: { tenantId, name: tableName }
    });
    
    if (!lookupTable) return null;
    
    // Substitute field values in match criteria
    const resolvedMatches: any = {};
    for (const [key, template] of Object.entries(matchFields)) {
      resolvedMatches[key] = this.substituteTemplate(
        template as string,
        lineItem
      );
    }
    
    // Find matching row
    const rows = lookupTable.rows as any[];
    const matchingRow = rows.find(row =>
      Object.entries(resolvedMatches).every(
        ([key, value]) => row[key] == value
      )
    );
    
    return matchingRow?.[returnField];
  }
  
  private substituteTemplate(template: string, data: any): any {
    return template.replace(/\${(\w+)}/g, (_, field) => data[field] || "");
  }
  
  private evaluateFormula(formula: string, context: any): any {
    // Simple expression evaluator
    const resolved = this.substituteTemplate(formula, context);
    try {
      return eval(resolved); // In production, use a safe expression evaluator
    } catch {
      return null;
    }
  }
}
```

### 5. BOM Generation

```typescript
// api/src/routes/fire-door-bom.ts

router.get('/:lineItemId/bom', async (req, res) => {
  const { lineItemId } = req.params;
  const { tenantId } = req.user!;
  
  // Get all components for this line item
  const components = await prisma.componentInstance.findMany({
    where: {
      tenantId,
      fireDoorLineItemId: lineItemId
    },
    include: {
      definition: true
    },
    orderBy: [
      { definition: { category: 'asc' } },
      { definition: { name: 'asc' } }
    ]
  });
  
  // Group by category
  const bom = {
    manufactured: components.filter(c => c.definition.category === 'MANUFACTURED'),
    purchased: components.filter(c => c.definition.category === 'PURCHASED'),
    assembly: components.filter(c => c.definition.category === 'ASSEMBLY')
  };
  
  // Calculate totals
  const totals = {
    manufactured: bom.manufactured.reduce((sum, c) => sum + (c.totalCost || 0), 0),
    purchased: bom.purchased.reduce((sum, c) => sum + (c.totalCost || 0), 0),
    assembly: bom.assembly.reduce((sum, c) => sum + (c.totalCost || 0), 0)
  };
  
  res.json({ components: bom, totals });
});
```

### 6. 3D Preview Data

```typescript
interface Preview3DData {
  components: {
    id: string;
    type: string; // "door_blank", "frame_jamb", "hinge", etc.
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    position: {
      x: number;
      y: number;
      z: number;
      rotation: number; // degrees
    };
    material: string;
    color?: string;
  }[];
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

// Generate 3D preview data from components
router.get('/:lineItemId/preview3d', async (req, res) => {
  const { lineItemId } = req.params;
  const { tenantId } = req.user!;
  
  const components = await prisma.componentInstance.findMany({
    where: { tenantId, fireDoorLineItemId: lineItemId },
    include: { definition: true }
  });
  
  const preview3D: Preview3DData = {
    components: components.map(c => ({
      id: c.id,
      type: c.definition.name.toLowerCase().replace(/\s+/g, '_'),
      dimensions: {
        width: c.properties.width || 0,
        height: c.properties.height || c.properties.length || 0,
        depth: c.properties.thickness || c.properties.depth || 0
      },
      position: c.position3D || { x: 0, y: 0, z: 0, rotation: 0 },
      material: c.properties.material || 'unknown',
      color: c.properties.finishColor || c.properties.finish
    })),
    boundingBox: {
      width: Math.max(...components.map(c => c.properties.width || 0)),
      height: Math.max(...components.map(c => c.properties.height || c.properties.length || 0)),
      depth: Math.max(...components.map(c => c.properties.thickness || 0))
    }
  };
  
  res.json(preview3D);
});
```

## Implementation Plan

### Phase 1: Schema & Models ✅
1. Create ComponentDefinition model
2. Create ComponentInstance model
3. Run migration

### Phase 2: Standard Component Definitions
1. Seed Door Blank definition
2. Seed Frame components (Jamb, Head, Stop)
3. Seed Ironmongery components (Hinge, Lock, Handle, etc.)
4. Seed Glass/Vision Panel definitions

### Phase 3: Component Generator Service
1. Build ComponentGeneratorService
2. Implement property extraction
3. Implement LOOKUP() integration
4. Add formula evaluation

### Phase 4: API Endpoints
1. POST /fire-door-line-items/:id/generate-components
2. GET /fire-door-line-items/:id/components
3. GET /fire-door-line-items/:id/bom
4. GET /fire-door-line-items/:id/preview3d

### Phase 5: UI Integration
1. Add "Generate Components" button in grid
2. Show BOM tab in line item detail
3. Add 3D preview (future)

## Usage Example

```typescript
// After importing CSV and creating line items
const lineItem = await prisma.fireDoorLineItem.create({
  data: {
    doorRef: "FD001",
    numberOfLeaves: 1,
    mLeafWidth: 916,
    leafHeight: 2050,
    leafThickness: 44,
    coreType: "Strebord",
    fireRating: "FD30",
    hingeQty: 3,
    hingeType: "Lift Off SSS",
    //... 200+ other fields
  }
});

// Generate components from line item
const componentGenerator = new ComponentGeneratorService();
const components = await componentGenerator.generateComponents({
  lineItemId: lineItem.id,
  tenantId: "LAJ_JOINERY_ID"
});

// Components generated:
// 1. Door Blank (qty: 1, dimensions: 916x2050x44, material: Strebord, cost: £32)
// 2. Frame Jamb (qty: 2, length: 2093, material: Softwood)
// 3. Frame Head (qty: 1, length: 986, material: Softwood)
// 4. Hinge (qty: 3, type: Lift Off SSS, cost: £1.67 each)
// 5. Intumescent Strip (qty: 1, type: 5mm STS)
// 6. Beech Lipping (qty: 3, size: 8x48x2400)
// 7. Laminate Facing (qty: 2, type: Portes Door Collection)
```
