# ProductPlan V1 - Code Reference & Integration Guide

**Quick Links to Key Files**

## Core Implementation Files

### 1. Type Definitions
**File**: [web/src/types/product-plan.ts](web/src/types/product-plan.ts)

```typescript
export const ProductPlanV1Schema = z.object({...})
export type ProductPlanV1 = z.infer<typeof ProductPlanV1Schema>

export function createFallbackDoorPlan(widthMm?, heightMm?, depthMm?): ProductPlanV1
export function createFallbackWindowPlan(widthMm?, heightMm?, depthMm?): ProductPlanV1
```

**Key Exports**:
- `ProductPlanV1Schema` - Zod schema
- `ComponentRoleSchema` - Enum of 18 roles
- `MaterialRoleSchema` - Enum of 12 roles
- `ProfileSlotSchema` - Profile slot types
- `GeometrySchema` - Box, profileExtrude, gltf geometry
- `TransformSchema` - Position and rotation
- `ComponentInstanceSchema` - Single component spec
- `DetectedSchema` - Category/type/option detection

### 2. AI Endpoint
**File**: [web/src/app/api/ai/generate-product-plan/route.ts](web/src/app/api/ai/generate-product-plan/route.ts)

```typescript
export async function POST(req: NextRequest): Promise<NextResponse>
```

**Workflow**:
1. Parse request: `{description, image?, existingProductType?, existingDims?}`
2. Call `callOpenAI(description, existingProductType, existingDims)` → ProductPlanV1 | null
3. If null, generate fallback plan via `createFallbackDoorPlan()` or `createFallbackWindowPlan()`
4. Log summary with `[AI2SCENE]` prefix
5. Return `NextResponse.json(plan)`

**System Prompt**: Lines 48-128 (80+ lines of joinery expert rules)  
**User Prompt Template**: Lines 130-149  
**API Call**: Lines 151-191 (OpenAI gpt-4o-mini)

### 3. Compilation (ProductPlan → ProductParams)
**File**: [web/src/lib/scene/plan-compiler.ts](web/src/lib/scene/plan-compiler.ts)

```typescript
export function compileProductPlanToProductParams(
  plan: ProductPlanV1,
  context?: PlanCompileContext
): ProductParams
```

**Key Functions**:
- `buildMaterialRoleMapFromPlan()` - Maps semantic roles to material IDs
- `mapMaterialRoleToId()` - TIMBER_PRIMARY → "timber_oak" etc.
- `detectPanelThickness()` - Extracts from plan components
- `extractConstructionFromPlan()` - Door/window-specific fields
- `logCompilationSummary()` - [AI2SCENE] debug logs
- `validateProductPlan()` - Returns error array

### 4. Rendering (ProductPlan → ComponentNode[])
**File**: [web/src/lib/scene/plan-renderer.ts](web/src/lib/scene/plan-renderer.ts)

```typescript
export function buildSceneFromPlan(
  plan: ProductPlanV1,
  context?: RenderContext
): ComponentNode[]
```

**Key Functions**:
- `computeVariableValues()` - Extract defaults from plan.variables
- `buildComponentNode()` - Single component instance
- `buildProfileExtrudeGeometry()` - Profile extrusion (SVG fallback to rect)
- `buildBoxGeometry()` - Box dimensions from expressions
- `buildGltfGeometry()` - GLTF model or placeholder
- `evaluateExpression()` - Safe math evaluation (pw, ph, sd, etc.)

### 5. Quote Integration
**File**: [web/src/lib/api/product-plan-integration.ts](web/src/lib/api/product-plan-integration.ts)

```typescript
export async function generatePlanForLineItem(lineItem): Promise<ProductPlanV1 | null>
export async function updateLineWithPlan(lineItemId, plan, quoteId): Promise<boolean>
export function getPlanFromLineItem(lineItem): ProductPlanV1 | null
```

## UI Integration

### Settings (TEMPLATE Mode)
**File**: [web/src/components/settings/ProductTypeEditModal.tsx](web/src/components/settings/ProductTypeEditModal.tsx)

**State Variables**:
```typescript
const [productPlan, setProductPlan] = useState<ProductPlanV1 | null>(null)
const [planVariables, setPlanVariables] = useState<Record<string, number>>({})
```

**New Tab**: "Component Plan"
- Shows detection summary (4-column grid: category, type, confidence, components)
- Parametric variables editor (grid of inputs with units)
- Component schedule table (ID, Role, Geometry type, Material role)
- Profile slots section (paste SVG text fields)
- "Compile Plan & Continue" button

**API Call** (lines ~100-135):
```typescript
const response = await fetch('/api/ai/generate-product-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: aiDescription,
    existingProductType: {...},
    existingDims: {...}
  })
})
const plan = await response.json() as ProductPlanV1
setProductPlan(plan)
setPlanVariables(...)
```

**Compile Action**:
```typescript
const params = compileProductPlanToProductParams(plan, { source: 'estimate' })
console.log('[AI2SCENE] Compiled params:', params)
setActiveTab('components')
```

## Usage Examples

### 1. Generate Plan for a Quote Line Item

```typescript
import { generatePlanForLineItem, updateLineWithPlan } from '@/lib/api/product-plan-integration'

const plan = await generatePlanForLineItem({
  id: 'line-123',
  description: '4-panel oak door',
  configuredProduct: {
    productType: { category: 'door', type: 'timber' },
    dimensions: { widthMm: 914, heightMm: 2032, depthMm: 45 }
  }
})

if (plan) {
  await updateLineWithPlan('line-123', plan, 'quote-456')
}
```

### 2. Compile and Use ProductParams

```typescript
import { compileProductPlanToProductParams, validateProductPlan } from '@/lib/scene/plan-compiler'

const errors = validateProductPlan(plan)
if (errors.length === 0) {
  const params = compileProductPlanToProductParams(plan, {
    templateId: 'product-type-789',
    source: 'estimate'
  })
  // Use params for 3D rendering, BOM, pricing, etc.
}
```

### 3. Build 3D Scene

```typescript
import { buildSceneFromPlan } from '@/lib/scene/plan-renderer'

const nodes = buildSceneFromPlan(plan, {
  textureMap: {...},
  profileCache: {...}
})

// Render nodes in 3D canvas
for (const node of nodes) {
  // node.id, node.geometry, node.transform, node.materialId, etc.
}
```

### 4. Debug Logging

```typescript
// Browser Console → check for:
[AI2SCENE] Generated ProductPlan: { ... }
[AI2SCENE] ProductPlan Compilation Summary: { ... }
[AI2SCENE] Building scene from ProductPlan: { ... }
[AI2SCENE] Scene generation complete: { ... }
[AI2SCENE] ProductPlan validation: ...
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Settings or Quote UI                        │
│  - User uploads image/description                               │
│  - Clicks "Generate with AI"                                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│    POST /api/ai/generate-product-plan                           │
│  - OpenAI gpt-4o-mini with system prompt                        │
│  - Returns ProductPlanV1 (or fallback if API fails)             │
│  - Logs [AI2SCENE] summary                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│               ProductPlanV1 (Zod validated)                     │
│  - detected: { category, type, option, confidence }            │
│  - dimensions: { widthMm, heightMm, depthMm }                  │
│  - materialRoles: { name → role }                              │
│  - profileSlots: { slot → { hint, source, svg? } }             │
│  - components: [ { id, role, geometry, transform, ... } ]      │
│  - variables: { pw, ph, sd, stileW, railH, ... }              │
│  - rationale: string                                            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓ (Settings: Show "Component Plan" tab)
                  │ (User edits variables, profiles, etc.)
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│           compileProductPlanToProductParams()                   │
│  - Extract variables → dimensions                              │
│  - Map materialRoles → materialRoleMap                          │
│  - Store profileSlots in customData                             │
│  - Store components metadata                                    │
│  - Logs [AI2SCENE] compilation summary                          │
│  - Returns ProductParams                                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│              buildSceneFromPlan()                                │
│  - Evaluate all expressions with variable values                │
│  - Build ComponentNode[] with geometry & transforms             │
│  - profileExtrude: SVG or rectangular fallback                  │
│  - box: dimensions from expressions                             │
│  - gltf: model or placeholder                                   │
│  - Logs [AI2SCENE] scene generation summary                     │
│  - Returns ComponentNode[]                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                 3D Canvas Rendering                             │
│  - Render ComponentNode[] as Three.js meshes                    │
│  - Apply materials based on materialRole                        │
│  - Position with transforms                                     │
│  - Display in ProductConfigurator3D                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ↓ (Settings: Save to /api/product-type/template-config)
                  │ (Quote: Save to /api/scene-state)
                  ↓
                Database
```

## Schema Enums

### ComponentRole (18 values)
```
STILE, RAIL_TOP, RAIL_MID, RAIL_BOTTOM, PANEL, GLASS, BEAD,
FRAME_JAMB_L, FRAME_JAMB_R, FRAME_HEAD, CILL, SEAL, LOCK, HANDLE,
HINGE, GLAZING_BAR, MOULDING, THRESHOLD, WEATHERBOARD
```

### MaterialRole (12 values)
```
TIMBER_PRIMARY, TIMBER_SECONDARY, PANEL_CORE, SEAL_RUBBER, SEAL_FOAM,
METAL_CHROME, METAL_STEEL, GLASS_CLEAR, GLASS_LEADED, GLASS_FROSTED,
PAINT_FINISH, STAIN_FINISH
```

### GeometryType (3 values)
```
"profileExtrude", "box", "gltf"
```

### DetectedCategory (3 values)
```
"door", "window", "frame"
```

## Expression Syntax

All geometry dimensions and positions use expression strings:

```
// Simple variables
"pw"                    → product width
"ph"                    → product height
"sd"                    → standard depth
"stileW"                → stile width (from variables)

// Arithmetic
"pw - stileW - stileW"  → available width minus two stiles
"(ph - railH - railH) / 2" → panel height (minus top/bottom rails, divided by 2)
"ph - railH"            → length from rail top to product bottom
"ph / 2"                → half height
"(nMullions + 1)"       → window grid count

// Constraints
All expressions clamped to reasonable ranges during compilation:
- Stile width: 35-100mm
- Rail height: 35-100mm
- Panel thickness: 12-25mm
- Profile depth: 35-150mm
```

## Common Integration Points

### 1. Load Plan from Saved Data
```typescript
const existingPlan = lineItem.customData?.plan as ProductPlanV1 | undefined
if (existingPlan) {
  // Render with buildSceneFromPlan()
} else {
  // Generate new plan
}
```

### 2. Edit and Re-Compile
```typescript
// User edits variable in UI
setPlanVariables({ ...planVariables, pw: 1000 })

// Re-compile
const updatedParams = compileProductPlanToProductParams(plan, {...})
// Re-render scene with new dimensions
```

### 3. Validation Before Save
```typescript
const errors = validateProductPlan(plan)
if (errors.length > 0) {
  toast({ variant: 'destructive', description: errors.join(', ') })
  return
}
// Proceed with save
```

### 4. Custom Material Override
```typescript
// Plan specifies TIMBER_PRIMARY → "timber_oak"
// User wants to change to "timber_walnut"
const params = compileProductPlanToProductParams(plan)
params.materialRoleMap['TIMBER_PRIMARY'] = 'timber_walnut'
// Re-render with new material
```

## Testing Checklist

- [ ] Generate plan from "4-panel door" description
- [ ] Verify plan has 5+ stiles, 3 rails, 4 panels
- [ ] Check component table shows correct roles
- [ ] Edit pw variable → verify expressions re-calculate
- [ ] Paste SVG profile text → verify stored in plan
- [ ] Click "Compile & Continue" → verify ProductParams created
- [ ] Inspect console for [AI2SCENE] debug logs
- [ ] Test in Quote → generatePlanForLineItem() works
- [ ] Test updateLineWithPlan() persistence to customData
- [ ] Verify WebGL cleanup on modal close (no context loss)

## Performance Baseline

| Operation | Time |
|---|---|
| AI endpoint call (gpt-4o-mini) | 1-2 seconds |
| Compilation | <10ms |
| Expression evaluation (all variables) | <5ms |
| Scene generation (200+ components) | <50ms |
| 3D rendering (Three.js) | 60 FPS |

## Troubleshooting

### Problem: [AI2SCENE] logs not appearing
**Solution**: Open DevTools → Console (not Network tab). Search for "[AI2SCENE]".

### Problem: Plan validation fails
**Solution**: Call `validateProductPlan(plan)` to get specific errors. Check component roles/materialRoles match enums.

### Problem: Scene doesn't render
**Solution**: Verify `buildSceneFromPlan()` returns non-empty array. Check geometry.type is valid. Inspect browser console for rendering errors.

### Problem: Expressions evaluate to 0
**Solution**: Check variable names are exact (case-sensitive). Verify math syntax is valid. Use safe eval function, not raw eval().

---

**ProductPlan V1**: Complete implementation reference and integration guide.
