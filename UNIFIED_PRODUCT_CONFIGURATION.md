# Unified Product Configuration System

## Architecture Overview

This system unifies **5 key concepts** into a cohesive product configuration and pricing engine that works for fire doors, bespoke windows, AI-generated products, and template-based configurations.

---

## Core Models

### 1. **LookupTableRow** - Materials & Products Database
*Single source of truth for everything you can select/purchase*

```typescript
LookupTableRow {
  // Display
  value: "oak-european"
  label: "European Oak"
  
  // Pricing (user customizable)
  costPerUnit: 45.50
  unitType: "sqm"
  markup: 35  // percentage
  
  // Supplier/BOM
  supplierId: "supplier-123"
  leadTimeDays: 14
  
  // 3D Rendering
  texture: "wood_oak_european.jpg"
  colorHex: "#D4A574"
  materialProps: { roughness: 0.6, metallic: 0.1 }
  
  // Technical
  fireRated: false
  grade: "FAS"
  
  // Custom properties
  customProps: { grainPattern: "straight", density: "medium" }
}
```

**Examples:**
- Timber → "European Oak", "American Walnut", "Sapele"
- Hinges → "Butt Hinge 100mm SS", "Continuous Hinge 2m"
- Glass → "6mm Toughened Clear", "Georgian Wire 7mm"
- Finishes → "RAL 9010 White", "Natural Oak Oil"
- Profiles → "68mm Chamfered", "98mm Ovolo"

**User Customization:**
- Update `costPerUnit` → affects all quotes using this material
- Change `supplierId` → routes orders to different supplier
- Modify `texture` → updates all 3D renders
- Add to `customProps` → extend without schema changes

---

### 2. **ComponentLookup** - Component Library
*Global library of reusable components (e.g., "Door Lipping", "Hinge Set")*

```typescript
ComponentLookup {
  code: "LIPT25"
  name: "Timber Lipping 25mm"
  componentType: "LIPPING"
  
  // Quantity calculation
  quantityFormula: "(leafHeight * 2 + leafWidth * 2) / 1000" // meters
  
  // Parametric sizing
  widthFormula: "25"  // mm
  heightFormula: "leafHeight"
  depthFormula: "leafThickness + 2"
  
  // Material reference
  materialId: null  // Selected at quote time from LookupTableRow
  
  // Pricing
  basePrice: 0  // Calculated from selected material's costPerUnit
}
```

**Connects to:**
- **LookupTableRow** via `materialId` → pulls material cost/specs
- **Profile** via `bodyProfileId` → defines shape for machining/CNC
- **ComponentTemplate** → defines when/how to auto-create this component

---

### 3. **ComponentTemplate** - Auto-Generation Rules
*Defines HOW and WHEN components are created from user input*

```typescript
ComponentTemplate {
  name: "Door Lipping Template"
  componentLookupId: "LIPT25"  // Creates instance of this component
  
  // Triggers (from fire door grid or configurator)
  requiredFields: ["leafHeight", "leafWidth", "lippingMaterial"]
  triggerFields: ["lippingMaterial", "leafHeight", "leafWidth"]
  
  // Material selection
  lookupTableId: "lookup-timber-table"
  lookupFieldName: "lippingMaterial"  // Field containing "oak-european"
  
  // Quantity calculation
  quantityFormula: "(leafHeight * 2 + leafWidth * 2) / 1000"
  quantityUnit: "meter"
  
  // Field mappings
  fieldMappings: {
    "lippingMaterial": "lookupTableRowId",  // Links to LookupTableRow
    "leafHeight": "heightParam",
    "leafWidth": "widthParam",
    "leafThickness": "depthParam"
  }
  
  // AI/ML integration
  aiCategories: ["lipping", "edge-banding", "door-edge"]
  aiKeywords: ["oak lipping", "timber edge", "25mm lipping"]
  
  // Product type linking
  productTypeIds: ["fire-door", "standard-door", "custom-door"]
}
```

**How it works:**
1. User fills field `lippingMaterial = "oak-european"` in fire door grid
2. Template sees trigger field changed
3. Finds LookupTableRow with value="oak-european" in lookupTable
4. Creates ComponentLookup instance with:
   - Material cost from LookupTableRow.costPerUnit
   - Quantity from formula: `(2100 * 2 + 900 * 2) / 1000 = 6 meters`
   - Price = `6m × £45.50/sqm × (1 + 35%) = £368.55`
5. Adds to BOM automatically

---

### 4. **ProductType** - Template Configurations
*Standard window/door configs that users can customize*

```typescript
ProductType {
  code: "FD30-SINGLE-GLAZED"
  name: "FD30 Single Door with Vision Panel"
  level: "option"  // category → type → option
  
  // Linked question set (what to ask user)
  questionSetId: "fire-door-questions"
  
  // Auto-assigned components via ProductTypeComponentAssignment
  componentAssignments: [
    {
      componentId: "CORE-FLAKE-FD30",
      isRequired: true,
      isDefault: true,
      quantityFormula: "1"
    },
    {
      componentId: "LIPT25",
      isRequired: true,
      quantityFormula: "(height * 2 + width * 2) / 1000"
    },
    {
      componentId: "GLASS-6MM-GEORGIAN",
      isRequired: false,  // Only if vision panel selected
      quantityFormula: "visionPanelWidth * visionPanelHeight / 1000000"
    }
  ]
}
```

**User Flow:**
1. Select product type: "FD30 Single Door with Vision Panel"
2. Answer questions:
   - Door size: 2100mm × 900mm
   - Lipping material: "European Oak"
   - Vision panel: Yes, 300mm × 500mm
   - Facing: "White Laminate"
3. System auto-creates components:
   - Door core (from ProductType assignment)
   - Lipping (from ComponentTemplate + user's material choice)
   - Vision glass (from conditional assignment)
   - Facing (from ComponentTemplate + user's finish choice)
4. Each component pulls pricing from LookupTableRow
5. Each component includes 3D data for rendering
6. Total BOM generated automatically

**User Customization:**
- Update material costs in LookupTableRow → all quotes recalculate
- Modify component formulas in ComponentTemplate → quantity logic updates
- Add new components to ProductType → standard config expands
- Change profiles → 3D render and machining updates

---

### 5. **AI Integration** - Vision to Components

**Flow:**
1. User uploads image of window/door
2. AI vision identifies:
   - Product type: "Casement Window"
   - Components: ["frame", "sash", "glazing", "hinges", "handle"]
   - Materials: ["timber frame", "clear glass", "stainless hinges"]
   - Dimensions: 1200mm × 1500mm

3. System matches AI output to ComponentTemplates:
   ```javascript
   // AI says: "timber frame"
   matchedTemplate = ComponentTemplate.find({
     aiKeywords: { contains: "timber frame" },
     aiCategories: { contains: "frame" }
   })
   
   // Template has lookupTableId: "timber-table"
   // User selects from LookupTableRow options in that table
   userSelection = "European Oak"  // from lookup table
   
   // Component created with:
   - material: LookupTableRow("oak-european")
   - quantity: from template formula
   - cost: from LookupTableRow.costPerUnit
   ```

4. User can customize any selection by choosing different LookupTableRow

---

## Complete Example: Fire Door Configuration

### Input (Fire Door Grid Row)
```javascript
{
  doorRef: "FD-001",
  leafHeight: 2100,
  leafWidth: 900,
  leafThickness: 54,
  coreType: "Flake",
  rating: "FD30",
  lippingMaterial: "oak-european",  // from Timber lookup table
  facing: "white-laminate",          // from Finishes lookup table
  hingeType: "butt-hinge-100-ss",    // from Hinges lookup table
  hingeQty: 3,
  glassType: "georgian-wire-7mm",    // from Glass lookup table
  visionPanelHeight: 500,
  visionPanelWidth: 300
}
```

### Processing
1. **ComponentTemplate "Door Core"** triggers:
   - Creates component from ComponentLookup("CORE-FLAKE-FD30")
   - Quantity: 1 EA
   - Cost: £45.00 (from component basePrice)

2. **ComponentTemplate "Door Lipping"** triggers:
   - Field changed: `lippingMaterial = "oak-european"`
   - Finds LookupTableRow in "Timber" table
   - Gets cost: £45.50/sqm
   - Calculates quantity: `(2100*2 + 900*2)/1000 = 6m`
   - Creates component with material link
   - Cost: 6m × £45.50 × 1.35 = £368.55

3. **ComponentTemplate "Door Facing"** triggers:
   - Field: `facing = "white-laminate"`
   - Finds LookupTableRow in "Finishes" table
   - Cost: £12.50/sqm
   - Quantity: `(2.1 × 0.9) × 2 sides = 3.78 sqm`
   - Cost: 3.78 sqm × £12.50 = £47.25

4. **ComponentTemplate "Hinges"** triggers:
   - Field: `hingeType = "butt-hinge-100-ss"`
   - Finds LookupTableRow in "Hinges" table
   - Cost: £8.50 per pair
   - Quantity: 3 pairs (from hingeQty)
   - Cost: 3 × £8.50 = £25.50

5. **ComponentTemplate "Vision Glass"** triggers:
   - Field: `glassType = "georgian-wire-7mm"`
   - Finds LookupTableRow in "Glass" table
   - Cost: £85.00/sqm
   - Quantity: `0.5 × 0.3 = 0.15 sqm`
   - Cost: 0.15 × £85.00 = £12.75

### Output: Automatic BOM
```javascript
{
  lineItems: [
    { component: "CORE-FLAKE-FD30", qty: 1, unit: "EA", cost: £45.00 },
    { component: "LIPT25", material: "oak-european", qty: 6, unit: "M", cost: £368.55 },
    { component: "LAM-FACE", material: "white-laminate", qty: 3.78, unit: "SQM", cost: £47.25 },
    { component: "HNG-BUTT-100", material: "butt-hinge-100-ss", qty: 3, unit: "PAIR", cost: £25.50 },
    { component: "GLASS-VISION", material: "georgian-wire-7mm", qty: 0.15, unit: "SQM", cost: £12.75 }
  ],
  totalMaterialCost: £499.05,
  
  // 3D render data from LookupTableRow textures
  materials3D: [
    { component: "lipping", texture: "wood_oak_european.jpg", color: "#D4A574" },
    { component: "facing", texture: "laminate_white.jpg", color: "#FFFFFF" },
    { component: "glass", texture: "glass_georgian_wire.jpg", opacity: 0.8 }
  ]
}
```

---

## Benefits

### ✅ Single Management Point
- Update oak price once in LookupTableRow → affects all products
- Change texture once → updates all 3D renders
- Modify formula once in ComponentTemplate → updates all instances

### ✅ Works for Multiple Use Cases
- **Fire doors**: 223 columns → ComponentTemplates auto-generate BOM
- **Bespoke windows**: Configurator → same ComponentTemplates
- **AI-generated**: Vision → matches to ComponentTemplates via keywords
- **Template products**: ProductType → predefined ComponentTemplates

### ✅ User Customization
- Material costs → LookupTableRow.costPerUnit
- Labour rates → ProcessCostRate (separate model)
- Profiles → Profile model linked to ComponentLookup
- Formulas → ComponentTemplate.quantityFormula

### ✅ Pricing Flexibility
- Base cost: LookupTableRow.costPerUnit
- Markup: LookupTableRow.markup
- Labour: ProcessCostRate.ratePerHour
- Overhead: Tenant settings

### ✅ 3D Integration
- Materials: LookupTableRow.texture, colorHex, materialProps
- Shapes: Profile.svgPath → Component.bodyProfileId
- Assembly: ComponentLookup formulas (positionX, width, height)

---

## Implementation Flow

### Phase 1: Data Consolidation ✅
- [x] Create LookupTableRow model
- [x] Create ComponentTemplate model
- [x] Migrate MaterialItems → LookupTableRow
- [x] Migrate IronmongeryItems → LookupTableRow

### Phase 2: Template System (NEXT)
- [ ] Create ProductTemplate UI
- [ ] Link ProductTypes → ComponentTemplates
- [ ] Build component auto-generation service
- [ ] Test with fire door grid

### Phase 3: AI Integration
- [ ] Add AI keyword matching to ComponentTemplate
- [ ] Vision → ComponentTemplate mapping
- [ ] User selection UI for AI suggestions

### Phase 4: 3D Rendering
- [ ] Link LookupTableRow.texture to 3D engine
- [ ] Profile → mesh generation
- [ ] Component assembly visualization
