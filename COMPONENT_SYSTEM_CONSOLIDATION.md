# Component System Consolidation Plan

## Current State - Two Separate Systems

### System 1: Product Type 3D Components (ProductTypeEditModal)
**Location**: ProductTypeEditModal > 3D Components tab
- **Purpose**: Visual/geometric component building for product templates
- **Data**: SceneConfig with geometry (boxes, positions, dimensions, transforms)
- **Features**: 3D preview, drag/drop positioning, visual editing
- **Storage**: `sceneConfig` JSON on ProductType options

### System 2: Business Components (Settings > Components)
**Location**: `/settings/components` and `/settings/components/[id]`
- **Purpose**: Component catalog with pricing, variants, attributes
- **Data**: ComponentLookup, ComponentVariant, ComponentAttribute
- **Features**:
  - **Details Tab**: Code, name, description, type, base price, supplier, lead time
  - **Variants Tab**: Specific variants with attribute values (e.g., "Oak Lipping 10mm")
  - **Attributes Tab**: Configurable attributes (timber, finish, dimensions)
  - **Processes Tab**: Manufacturing processes (planned)
- **Storage**: Database tables (ComponentLookup, ComponentVariant, ComponentAttribute)

### The Disconnect

**Problem**: Two disconnected systems managing "components"
- 3D components are geometric shapes for visualization
- Business components are catalog items for pricing/BOM
- No link between them - a 3D box labeled "stile" doesn't reference the business component "Stile - Oak 114mm"

**Example Scenario**:
1. User uploads door image → AI generates 7 geometric components (boxes)
2. User goes to Settings > Components → Sees completely different component catalog
3. No way to link 3D geometric "stile" to business component "STILE-OAK-114"
4. Pricing engine can't price the 3D configuration

## Proposed Unified Solution

### Architecture Decision

**Keep both systems but create a linking layer:**

1. **3D Components** remain geometric (visualization layer)
2. **Business Components** remain catalog-based (pricing/BOM layer)
3. **NEW: Component Mapping** links geometric components to business components

### Implementation Plan

#### Phase 1: Link 3D Components to Business Components

**Add to SceneConfig component structure:**
```typescript
{
  id: "stile-left",
  type: "Box",
  geometry: { dimensions: [114, 2032, 58] },
  transform: { position: [0, 0, 0] },
  material: { materialId: "oak" },
  metadata: {
    label: "Left Stile",
    // NEW: Link to business component
    componentLookupId: "cmp_123456",
    variantCode: "STILE-OAK-114",
    // Keep geometric data for visualization
    width: 114,
    height: 2032,
    depth: 58
  }
}
```

#### Phase 2: Update ProductTypeEditModal

**Add new tab: "Component Mapping"**

Tab order:
1. Overview - Basic info
2. Generate with AI - Auto-generate geometry
3. 3D Components - Visual editing
4. **Component Mapping** - Link 3D to business components ← NEW
5. Profiles - Profile assignment

**Component Mapping Tab UI:**
```
┌─────────────────────────────────────────────────┐
│ 3D Component              Business Component    │
├─────────────────────────────────────────────────┤
│ Left Stile (114x2032x58) → [Select Component ▼] │
│   └─ Currently: STILE-OAK-114 £12.50           │
│                                                  │
│ Right Stile              → [Select Component ▼] │
│   └─ Currently: STILE-OAK-114 £12.50           │
│                                                  │
│ Top Rail                 → [Select Component ▼] │
│   └─ Currently: RAIL-OAK-114 £8.75             │
└─────────────────────────────────────────────────┘
```

#### Phase 3: Consolidate Component Creation

**Remove ComponentPickerDialog from ProductTypesSection**

Instead:
- ProductTypesSection only shows "Configure Product" button
- ProductTypeEditModal handles ALL product configuration
- Component Mapping tab handles linking to business components
- Business components created/edited only in Settings > Components

**Benefits:**
- Single source of truth for business components
- Clear separation: ProductTypes = templates, Components = catalog
- 3D view + business logic integrated in one workflow

#### Phase 4: Enhance Settings > Components

**Add 3D preview to component detail page:**

When viewing component "STILE-OAK-114":
- Show basic 3D preview of the component
- Upload GLB/GLTF 3D model (existing feature)
- Upload SVG profile (existing feature)
- Link to products using this component

### Data Flow

#### Creating a Product Type (Complete Flow)

1. **Overview Tab**: Name it "6-Panel Traditional Door"
2. **Generate with AI Tab**: Upload door image
   - AI generates 7 geometric components (stiles, rails, panels)
   - Stores in `sceneConfig.components[]`
3. **3D Components Tab**: Arrange and refine
   - Adjust positions, dimensions
   - Add/remove components
4. **Component Mapping Tab**: Link to business catalog
   - "Left Stile" → "STILE-OAK-114" (£12.50)
   - "Top Rail" → "RAIL-OAK-114" (£8.75)
   - Stores `componentLookupId` and `variantCode` in metadata
5. **Profiles Tab**: Assign profiles (future)
6. **Save**: Product type ready for quotes

#### Quoting a Product

1. Quote builder selects product type "6-Panel Traditional Door"
2. Loads `sceneConfig` with geometric data + component mappings
3. For each 3D component, resolve:
   - `componentLookupId` → ComponentLookup → base price
   - `variantCode` → ComponentVariant → specific price
   - Dimensions from geometry → calculate quantities
4. Generate line items with correct pricing

### Migration Path

**Existing Data:**
- ProductTypes with `sceneConfig` → Keep as-is
- Existing components → No changes needed

**New Products:**
- Use new ProductTypeEditModal with mapping tab
- Gradually add component mappings to existing products

## Decision Matrix

| Approach | Pros | Cons |
|----------|------|------|
| **Current (two separate systems)** | Already built | Disconnected, can't price 3D configs |
| **Merge into one system** | Simpler conceptually | Mixing visualization with business logic, complex refactor |
| **Link both systems (proposed)** | Best of both worlds, clear separation of concerns | Requires mapping layer |
| **3D only, delete business components** | Simplest | Lose pricing, attributes, variants, supplier tracking |

**Recommendation: Link both systems** ✅

## Next Steps

1. Add `componentLookupId` and `variantCode` to SceneConfig component metadata
2. Create Component Mapping tab in ProductTypeEditModal
3. Add component picker that filters by type and shows price
4. Update quote builder to use component mappings for pricing
5. Remove ComponentPickerDialog from ProductTypesSection
6. Document the complete workflow

## Files to Modify

1. `web/src/types/scene-config.ts` - Add component linking fields
2. `web/src/components/settings/ProductTypeEditModal.tsx` - Add mapping tab
3. `web/src/components/settings/ProductTypesSection.tsx` - Remove ComponentPickerDialog
4. `web/src/components/settings/ComponentMappingTab.tsx` - NEW component
5. Quote builder integration (future)
