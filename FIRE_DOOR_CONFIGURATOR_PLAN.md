# Fire Door Configurator System - Phase 0 & 1 Plan

## Phase 0: Existing System Inventory

### ✅ **WHAT EXISTS** - Foundational Infrastructure

#### 1. **Prisma Database Models** (Already Built)

**Component & BOM System:**
- ✅ `ComponentLookup` - Flexible component catalog with formulas, pricing, supplier links
- ✅ `ComponentVariant` - Specific variants with attributes (e.g., "Oak Lipping 10mm")
- ✅ `ComponentAttribute` - Dynamic attributes (timber, finish, grade)
- ✅ `ComponentProfile` - 3D geometry definitions
- ✅ `Profile` - Reusable 2D cross-section profiles (SVG paths, dimensions)
- ✅ `ComponentProcess` - Links components to manufacturing operations
- ✅ `BOMLineItem` - Bill of materials generation
- ✅ `BOMVariantLineItem` - Enhanced BOM with specific variants

**Product Configuration:**
- ✅ `ProductType` - Tree-structured taxonomy (category → type → option)
- ✅ `ProductTypeComponent` - Maps components to product types
- ✅ `ProductTypeComponentAssignment` - Component-product relationships

**Project Management:**
- ✅ `Project` - Polymorphic project container
- ✅ `Quote` + `QuoteLine` - Quotation system
- ✅ `Opportunity` - Sales pipeline
- ✅ `FireDoorScheduleProject` - Specialized fire door projects

**Manufacturing:**
- ✅ `WorkshopProcessDefinition` - Process definitions
- ✅ `ProcessTimingPrediction` - ML-predicted timing
- ✅ `ProcessCostRate` - Labor costing
- ✅ `TimeEntry` - Time tracking
- ✅ `FireDoorProductionLog` - Production progress tracking

**Materials:**
- ✅ `Material` - Material catalog (timber, finishes, glass, etc.)
- ✅ `MaterialItem` - Specific material inventory items

**Suppliers:**
- ✅ `Supplier` - Supplier records
- ✅ `SupplierQuoteRequest` - Quote requests
- ✅ `PurchaseOrder` - Purchasing

#### 2. **3D Configurator System** (Fully Implemented)

**Core Architecture:**
- ✅ `web/src/types/scene-config.ts` - Scene graph data model
- ✅ `web/src/types/resolved-product.ts` - Product resolution types
- ✅ `web/src/components/configurator/ProductConfigurator3D.tsx` - Main configurator (1800+ lines)
- ✅ `web/src/components/configurator/ProductComponents.tsx` - 3D component renderer
- ✅ `web/src/components/configurator/GltfModel.tsx` - GLTF asset loader

**Parametric Builders:**
- ✅ `web/src/lib/scene/parametric-door.ts` - Door builder (500+ lines)
- ✅ `web/src/lib/scene/parametric-window.ts` - Window builder
- ✅ `web/src/lib/scene/parametric-window-curves.ts` - Curved geometry
- ✅ `web/src/lib/scene/builder-registry.ts` - Builder factory pattern
- ✅ `web/src/lib/scene/geometry.ts` - 3D geometry utilities
- ✅ `web/src/lib/scene/materials.ts` - PBR material system

**Costing Integration:**
- ✅ `web/src/lib/costing/bom.ts` - BOM generation (160 lines)
- ✅ `web/src/lib/costing/cutlist.ts` - Cutting list generation (170 lines)
- ✅ `web/src/lib/costing/pricing.ts` - Pricing calculation (200 lines)

**AI Integration:**
- ✅ `web/src/hooks/useAIConfigurator.ts` - AI-driven configuration
- ✅ `web/src/lib/scene/resolve-product.ts` - Template resolution (260 lines)
- ✅ `web/src/lib/scene/expression-eval.ts` - Expression evaluator (280 lines)
- ✅ `web/src/lib/scene/templates/` - Template library

#### 3. **BOM Generation Service** (Backend)

**File:** `api/src/services/bom-generator.ts` (500+ lines)

**Features:**
- ✅ Inclusion rules engine (equals, contains, greaterThan, lessThan, in, notEmpty)
- ✅ Quantity formula evaluation with safe Function constructor
- ✅ Component-level conditional logic
- ✅ Automatic BOM generation from `configuredProduct.selections`
- ✅ Storage in `QuoteLine.configuredProduct.derived.bom`

**API Endpoints:**
- `POST /tenant/bom/generate-for-quote` - Generate BOM for entire quote
- `POST /tenant/bom/generate-for-line` - Generate BOM for single line
- `GET /tenant/bom/component/:id` - Component details with evaluation
- `POST /tenant/bom/component/:id/inclusion-rules` - Update rules
- `POST /tenant/bom/component/:id/quantity-formula` - Update formula

#### 4. **PDF System** (Limited)

**Existing Capabilities:**
- ✅ `api/src/lib/pdf/parser.ts` - PDF text extraction (JoinerySoft, supplier quotes)
- ✅ `api/src/lib/pdfParsing.ts` - Shared PDF parsing utilities
- ✅ `scripts/generate-guide-pdf.js` - Minimal PDF generation example (customer guide)

**Missing:**
- ❌ No workshop paperwork PDF generator
- ❌ No cutting list PDF
- ❌ No production schedule PDF
- ❌ No QA checklist generator

#### 5. **Fire Door Specific** (Partial)

**Data Models:**
- ✅ `FireDoorScheduleProject` - Project tracking
- ✅ `FireDoorProductionLog` - Progress tracking (blanks cut, edgeband, CNC, etc.)
- ✅ `FireDoorClientJob` - Client jobs
- ✅ `LippingLookup` - Lipping thickness by doorset type

**UI Pages:**
- ✅ `web/src/app/fire-door-schedule/page.tsx` - Schedule management
- ✅ `web/src/app/fire-door-quotes/[id]/page.tsx` - Quote builder (144 columns!)
- ✅ `web/src/app/fire-door-quotes/[id]/fire-door-grid.tsx` - AG Grid spreadsheet

**Missing:**
- ❌ No fire door product template configurator
- ❌ No automated fire rating rules engine
- ❌ No certification tracking per configuration
- ❌ No automatic component selection by fire rating

---

### ❌ **WHAT'S MISSING** - Critical Gaps

#### 1. **Fire Door Domain Model**

**No explicit fire door configuration schema:**
- Need `FireDoorConfiguration` model or use existing `ProductConfiguration`
- Need fire rating rules (FD30/FD60/FD90/FD120 → component requirements)
- Need certification tracking (which test certificates apply)
- Need seal requirements (intumescent, smoke, acoustic)

**CSV Column Mappings:**
- Need structured mapping from Paul's CSV columns to attribute definitions
- Need dropdown options for all enumerated fields (handing, frame type, etc.)
- Need validation rules for each attribute

#### 2. **Pricing Engine**

**No fire door-specific pricing calculator:**
- Existing `web/src/lib/costing/pricing.ts` is generic
- Need fire door formulas:
  - Material cost = sum(BOM qty × unit cost)
  - Labour cost = sum(operation minutes × shop rate)
  - Overhead allocation
  - Margin calculation
- Need explainability (why was this component included?)

#### 3. **Workshop Paperwork Generator**

**No PDF generation for:**
- Production summary sheet
- Cutting list (profile lengths, panel dims)
- Machining sheet (hinge prep, lock case, closers, seals)
- Ironmongery schedule (brand/model + quantities)
- Glazing schedule (glass spec + sizes)
- QA checklist
- Door labels (ref, rating, handing, dims)

**Recommendation:** Use existing PDF libraries or build with `pdfkit` / `puppeteer`

#### 4. **3D Model Generation**

**Partially exists but not connected:**
- ✅ Have parametric door builder (`parametric-door.ts`)
- ✅ Have GLTF export capability
- ❌ NOT connected to fire door configuration UI
- ❌ No automatic geometry from fire door spec
- ❌ No hardware placement by rules

**Need:**
- Bridge from `FireDoorLineItem` → `ProductParams` → 3D scene
- Automatic hardware positioning (hinges, locks, closers)
- Vision panel cutouts from spec
- Sidelight/toplight generation

---

## Phase 1: CSV to Domain Model

### Step 1: Analyze Paul's CSV Column Dictionary

**File:** `/Users/Erin/Library/Mobile Documents/com~apple~CloudDocs/Coaching/Aldridge Joinery/Costing Files/Pauls Quote List Explained.csv`

**Total Columns:** 200+ (A-FZ+)

**Column Groupings:**

#### **GROUP 1: IDENTIFIERS** (Columns A-D)
- `A: Sequence` - Auto-generated row number
- `B: Batch/Phase` - Production phasing
- `C: Door Ref` - Client reference (user-filled)
- `D: Location` - Site location (user-filled)

**Mapping:**
- Store in `QuoteLine.meta.doorRef`, `meta.location`, `meta.batch`
- No special attributes needed

---

#### **GROUP 2: PRODUCT STRUCTURE** (Columns E-N)

**Column E: Doorset/Leaf/Frame** (CRITICAL - drives everything)
- Options: `Doorset`, `Doorset with Fanlight/Overpanel`, `Doorset with Screen`, `Leaf Only`, `Frame Only`, `Components`
- **Impact:** Determines which components are included in BOM
- **Attribute:** `doorsetStructure` (ENUM)

**Column F: Type** (Client free text)
- **Attribute:** `clientType` (TEXT)

**Column G: Quantity** (defaults to 1)
- **Standard:** Use `QuoteLine.qty`

**Column H: Fire Rating** (CRITICAL - affects certification)
- Options: `None`, `FD30`, `FD60`, `FD90`, `FD120`
- **Impact:** Core type, glass type, intumescent, certification
- **Attribute:** `fireRating` (ENUM)
- **Rule Engine:** IF `fireRating = FD60` THEN `coreType = 'Strebord'` AND `glassBead = 'Intumescent'`

**Column I: Acoustic Rating** (affects seals/glass)
- Options: `None`, `29dB`, `32dB`, `37dB`, `42dB`
- **Impact:** Core type, glass type, drop seals
- **Attribute:** `acousticRating` (ENUM)

**Column J-K: Bottom Seal** (auto-fills based on acoustic rating)
- **Attribute:** `bottomSealRequired` (BOOLEAN, calculated)
- **Attribute:** `bottomSealType` (ENUM: `Drop Seal`, `Fixed Seal`)

**Column L: Lead Lining** (affects frame/facing)
- Options: `None`, `1mm Lead`, `2mm Lead`
- **Impact:** Forces rebated 57/32 frame, adds MDF facings, requires lead glass
- **Attribute:** `leadLiningCode` (ENUM)

**Column M: Number of Leaves** (inc. solid overpanel)
- Auto-calculated from leaf configuration
- **Attribute:** `leafCount` (NUMBER, calculated)

**Column N: Leaf Configuration** (affects sizing/hinging)
- Options: `Single`, `Leaf & a Half`, `Double`
- **Impact:** Sizing formulas, hinge quantities, master/slave split
- **Attribute:** `leafConfiguration` (ENUM)

**Column O: Master Leaf Size** (only for Leaf & a Half)
- Default: 926mm (can override)
- **Attribute:** `masterLeafWidth` (NUMBER)

---

#### **GROUP 3: ACTION & OPERATION** (Columns P-Q)

**Column P: Action**
- Options: `Single`, `Double`, `Sliding`, `Pocket`, `BiFold`, `Anti Barricade`, `Special`
- **Impact:** Fire rating constraints, hinging, frame type, processes
- **Attribute:** `action` (ENUM)

**Column Q: Handing**
- Options: `LH`, `RH`, `LH (Master)`, `RH (Master)`, `Double Doors`, `N/A`
- **Attribute:** `handing` (ENUM)

---

#### **GROUP 4: IRONMONGERY** (Columns R-BG)

**Hinges (R-U):**
- `R: Hinge Supply Type` → `Supplied`, `Free Issue`
- `S: Hinge Qty` → Auto-calculated from leaf count + hinge type
- `T: Hinge Type` → V-lookup from catalog
- `U: Hinge Configuration` → `Hi Load` (default), others

**Locks (V-AE):**
- `V: Lock Prep` → Auto-fills = `leafCount × lockCount`
- `W: Lock Supply Type` → `Free Issue`, `LAJ Supply`
- `X: Lock Type 1` → Catalog dropdown
- `Y: Lock Height` → Default 950mm
- `Z: Spindle face prep` → `One Face`, `Both Faces`
- `AA: Cylinder Face Prep` → `One Face`, `Both Faces`
- `AB-AE:` Lock Type 2 (repeat for second lock)

**Additional Hardware (AF-BG):**
- `AF-AG:` Flush Bolts (qty defaults to 2)
- `AH:` Levers & Pull Handles
- `AI:` Escutcheons/Bathroom Turn (auto-fills from lock type)
- `AJ-AK:` Cylinders
- `AL-AQ:` Finger Plates, Kick Plates, Bump Plates, Signage
- `AR-AV:` Letter Plate, Door Viewer (affects fire rating if present)
- `AW-BG:` Door Chain, Finger Protection, Fire ID Disc, Factory Fit options, Closers, Wiring

**Attributes Needed:**
- `hingeSupplyType`, `hingeQty`, `hingeType`, `hingeConfiguration`
- `lockSupplyType`, `lockType1`, `lockHeight1`, `lockType2`, `lockHeight2`
- `flushBoltType`, `flushBoltQty`
- ... (30+ ironmongery attributes)

**BOM Rules:**
- IF `hingeSupplyType = 'Supplied'` THEN include `ComponentLookup` for `hingeType`
- IF `lockType1` specified THEN include lock component + prep process
- Quantity formulas use `leafCount`, door dimensions

---

#### **GROUP 5: GEOMETRY & DIMENSIONS** (Columns BP-DJ)

**Frame/Opening Sizes (BP-BV):**
- `BP: S/O Width` (Structural Opening Width) - required for doorset
- `BQ: S/O Height` (Structural Opening Height)
- `BR: S/O Wall Thickness`
- `BS: Extension Material` (auto-defaults to MDF if needed)
- `BT-BU:` Extension lining width (calculated)

**Fanlight/Overpanel (BV-CA):**
- `BX: Fanlight/Overpanel Qty`
- `BY: Fanlight Frame Thickness` (auto-generated from certification)
- `BZ: Fanlight/Overpanel Height` (reduces doorset frame height)
- `CA: Fanlight/Overpanel Width`

**Sidelights (CB-CM):**
- `CB-CD:` Sidelight 1 (qty, width, height)
- `CE-CG:` Sidelight 2
- `CH-CJ:` Sidelight 3
- `CK-CM:` Sidelight 4

**Fanlight/Sidelight Glazing (CN):**
- Options: `Solid Panel`, `6mm Textured Georgian`, `6mm Clear Safety`, etc.
- **Attribute:** `fanlightGlazingType` (ENUM)

**Outside Frame Dimensions (CO-CP):**
- `CO: O/F Width (doorset)` = S/O Width - wriggle room - sidelight widths
- `CP: O/F Height (doorset)` = S/O Height - wriggle room - fanlight height
- **Calculated attributes**

**Leaf Dimensions (DH-DJ):**
- `DH: M Leaf Width` - Auto-calculated from O/F width - frame - stiles
- `DI: S Leaf Width` (if double/leaf & half)
- `DJ: Leaf Height` - Auto-calculated from O/F height - frame - rails
- `DK: Leaf Thickness` - Auto-calculated from fire rating + closer type

**Attributes:**
- `structuralOpeningWidth`, `structuralOpeningHeight`, `wallThickness`
- `outsideFrameWidth`, `outsideFrameHeight` (calculated)
- `masterLeafWidth`, `slaveLeafWidth`, `leafHeight`, `leafThickness` (calculated)
- Formulas reference parent attributes

---

#### **GROUP 6: CONSTRUCTION - LEAF** (Columns DK-FB)

**Core & Style (DL-DM):**
- `DL: Core Type` → Auto from fire rating (Strebord for FD60+)
- `DM: Leaf Style` → `Solid`, `Panelled`, `Glazed`, etc. (affects pricing, labour)

**Vision Panels (DN-EC):**
- `DN: Vision Panel Qty, Leaf 1` (1-4 VPs possible)
- `DO-DP:` Aperture 1 Width/Height (client size)
- `DQ-DR:` Aperture 1 Production Size (adds beading clearance)
- `DS:` Aperture Position 1
- `DT-DX:` Aperture 2 (if qty >1)
- `DY-EB:` Air Transfer Grille (qty, size, position)
- `EC-EJ:` Vision Panel Leaf 2 (repeat for slave leaf)

**Glass & Beading (EJ-EP):**
- `EJ: Vision Panel Size Detail` → Defaults to `Cut Out`
- `EM: Glass Type` → Auto from fire rating concat (e.g., `Pyroguard 30-32`, `Pyran S 60-44`)
- `EN: Bead Type` → Auto from certification
- `EO-EP:` Bead Material (oak, MDF, primed)

**Facings & Finish (ET-FC):**
- `ET: Door Facing` → `Laminate`, `Veneer`, `Paint`, `PVC Wrapped`
- `EU-EV:` Door Finish Side 1/2 (e.g., `Oak Natural`, `White Primer`)
- `EW: Door Colour` (if known)

**Lippings (EX-FA):**
- `EX: Lipping Material` → Auto from facing type
- `EY: Lipping Material (Production)` → Hardwood, Oak, Softwood
- `EZ: Lipping Style` → `Solid Timber`, `2-Tone`, `Matching Veneer`
- `FA: Lipping Thickness` → Default 8mm

**Edge Protection (FC-FF):**
- `FC: Door Edge Protection Type` → `Armor Plate`, `PVC`, `None` (depends on leaf thickness)
- `FD: Door Edge Protection Position` → `Leading Edge`, `All Edges`
- `FE: PVC Face Protection` → `Yes/No` (affects glue type, labour)
- `FF: PVC Colour`

**Undercut & Certification (FG-FK):**
- `FG: Door Undercut` → Default 8mm
- `FH: Certification` → Auto from fire rating + components
- `FI-FK:` Q Mark Plug Colours (outer, tree, vision panel)

**Attributes:**
- `coreType`, `leafStyle`, `visionPanelQty1`, `vp1Width`, `vp1Height`, `vp1Position`
- `glassType`, `beadType`, `beadMaterial`
- `doorFacing`, `doorFinishSide1`, `doorFinishSide2`
- `lippingMaterial`, `lippingThickness`
- `edgeProtectionType`, `edgeProtectionPosition`
- `doorUndercut`, `certification`

---

#### **GROUP 7: CONSTRUCTION - FRAME** (Columns CQ-DD)

**Frame Specification (CQ-CY):**
- `CQ: Frame Thickness` = Wall thickness - extension lining
- `CR: Frame Material` → Dropdown (fire rating dependent: no softwood/beech for FD60+)
- `CS: Frame Material (Production)` → Auto-fill translation
- `CT-CX:` Lining/Jamb/Head profiles (auto from frame type)
- `CY: Frame Type` → `Rebated`, `Planted Stop`, `Adjustable`, etc.

**Stops & Arcs (CZ-DG):**
- `CZ-DC:` Stop Material, Rebate/Stop dimensions
- `DD-DG:` Arc Material, Arc Detail, Arc dimensions

**Attributes:**
- `frameThickness`, `frameMaterial`, `frameType`
- `stopMaterial`, `stopWidth`, `stopDepth`
- `arcMaterial`, `arcWidth`, `arcDepth`

---

#### **GROUP 8: NOTES & PRICING** (Columns FL-FX)

**Material Sustainability (FL):**
- Dropdown for certifications

**Client Notes (FQ-FU):**
- `FQ: Important notes for Fire Rating` (conditional formatting)
- `FR-FU:` Client Notes 1-4

**Certification Docs (FV-FW):**
- `FV: Test Certificate Used`
- `FW: Associated Document`

**Pricing (FM-FP):**
- `FM: Door Ref7` (duplicate ref for internal tracking)
- `FN: Price Ea` (unit price - **calculated**)
- `FO: Qty2` (quantity - from Column G)
- `FP: Line Price` (total - **calculated**)

**Formula:** `Price Ea = (Material Cost + Labour Cost + Overhead) / (1 - Target Margin)`

---

#### **GROUP 9: CALCULATED/TECHNICAL FIELDS** (Columns FX-GZ)

**These are auto-calculated for production/weight estimates:**
- `FX: Master Leaf Weight (Approx) kg`
- `FZ-GH:` Fire rating checks, leaf type, concat fields
- `GI-GJ:` Slave Leaf Weight
- `GK-GZ:` Frame component weights, doorset total weight

**Do NOT expose to user** - these are backend calculations.

---

### Step 2: Define Attribute Schema

**Use existing `Attribute` model or create `FireDoorAttributeDefinition`:**

```prisma
model Attribute {
  id          String   @id @default(cuid())
  tenantId    String
  key         String   // e.g., "fireRating", "leafConfiguration"
  label       String   // e.g., "Fire Rating", "Leaf Configuration"
  type        String   // "SELECT", "NUMBER", "TEXT", "BOOLEAN", "CALCULATED"
  category    String?  // "IDENTIFICATION", "STRUCTURE", "IRONMONGERY", "GEOMETRY", "CONSTRUCTION", "FINISH"
  
  // For SELECT types
  enumOptions Json?    // ["FD30", "FD60", "FD90", "FD120"]
  
  // For NUMBER types
  unit        String?  // "mm", "kg", "dB", "minutes"
  min         Float?
  max         Float?
  defaultValue Float?
  
  // For CALCULATED types
  formula     String?  // "outsideFrameWidth - frameThickness * 2 - stileWidth * 2"
  
  // Validation
  required    Boolean  @default(false)
  validation  Json?    // Additional rules
  
  // UI
  helpText    String?
  sortOrder   Int      @default(0)
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, key])
}
```

**Seed Script:** Load CSV column dictionary → create `Attribute` records

---

### Step 3: Map CSV Columns to Components

**Example: Hinges**

**CSV Columns:**
- `R: Hinge Supply Type` → Attribute: `hingeSupplyType`
- `S: Hinge Qty` → Calculated attribute (formula: `leafCount × hingesPerLeaf`)
- `T: Hinge Type` → Attribute: `hingeType` (dropdown from `ComponentLookup` where `componentType = 'HINGE'`)
- `U: Hinge Configuration` → Attribute: `hingeConfiguration` (default: `Hi Load`)

**Component Rule:**
```json
{
  "componentCode": "HINGE-BT-SS",
  "inclusionRules": {
    "hingeSupplyType": { "operator": "equals", "value": "Supplied" }
  },
  "quantityFormula": "{leafCount} * {hingesPerLeaf}"
}
```

**Repeat for all component types:**
- Locks, flush bolts, closers, seals, glass, beads, lippings, facings, cores, frames, arcs, etc.

---

### Step 4: Define Rules Engine

**Fire Rating Rules:**

```typescript
const fireRatingRules = {
  FD30: {
    coreType: 'Strebord FD30',
    minLeafThickness: 44,
    intumescentStrip: 'FD30 15x4mm',
    glassBead: 'Timber Non-Intumescent',
    glassTypes: ['Pyroguard 30-32', 'Pilkington Pyrostop 30-16'],
    certification: ['CERTIFIRE CF5023', 'BWF-CERTIFIRE FDIS001'],
  },
  FD60: {
    coreType: 'Strebord FD60',
    minLeafThickness: 54,
    intumescentStrip: 'FD60 20x4mm',
    glassBead: 'Intumescent Glazing Bead',
    glassTypes: ['Pyroguard 60-44', 'Pilkington Pyrostop 60-32'],
    certification: ['CERTIFIRE CF5024', 'BWF-CERTIFIRE FDIS002'],
    restrictions: {
      frameMaterial: { exclude: ['Softwood', 'Beech'] }, // Must use Maple-Beech Stained or Hardwood
      letterPlate: false, // Not permitted
      doorViewer: false,  // Not permitted
    },
  },
  // ... FD90, FD120
};
```

**Apply in BOM Generator:**

```typescript
function applyFireRatingRules(config: FireDoorConfig): void {
  const rules = fireRatingRules[config.fireRating];
  
  config.coreType = rules.coreType;
  config.intumescentStrip = rules.intumescentStrip;
  config.glassBead = rules.glassBead;
  
  if (config.visionPanelQty > 0 && !rules.glassTypes.includes(config.glassType)) {
    throw new Error(`Glass type ${config.glassType} not permitted for ${config.fireRating}`);
  }
  
  if (config.letterPlate && rules.restrictions?.letterPlate === false) {
    throw new Error(`Letter plate not permitted for ${config.fireRating}`);
  }
}
```

---

### Step 5: Create Mapping Document

**File:** `FIRE_DOOR_CSV_MAPPING.md`

**Structure:**

```markdown
# Fire Door CSV Column Mapping

## Column Groups

### GROUP 1: IDENTIFIERS (A-D)
| CSV Column | Attribute Key | Type | Description | UI Widget |
|------------|---------------|------|-------------|-----------|
| A | sequence | NUMBER | Auto-generated | Hidden |
| B | batch | TEXT | Batch/Phase | Input |
| C | doorRef | TEXT | Door Reference | Input (required) |
| D | location | TEXT | Site Location | Input |

### GROUP 2: PRODUCT STRUCTURE (E-O)
| CSV Column | Attribute Key | Type | Options | Impact | UI Widget |
|------------|---------------|------|---------|--------|-----------|
| E | doorsetStructure | SELECT | Doorset, Doorset with Fanlight, Leaf Only, Frame Only, Components | Determines BOM inclusion | Dropdown |
| H | fireRating | SELECT | None, FD30, FD60, FD90, FD120 | Core type, glass, certification | Dropdown (critical) |
| I | acousticRating | SELECT | None, 29dB, 32dB, 37dB, 42dB | Seals, glass, core | Dropdown |
| N | leafConfiguration | SELECT | Single, Leaf & a Half, Double | Sizing, hinges | Dropdown |

... (continue for all 200+ columns)
```

---

## Proposed Minimal Schema Changes

### Option 1: Use Existing `configuredProduct` JSON Field

**No new tables needed!**

**In `QuoteLine.configuredProduct.selections`:**

```json
{
  "doorRef": "DOOR-1",
  "location": "Ground Floor Entrance",
  "fireRating": "FD60",
  "doorsetStructure": "Doorset with Fanlight",
  "leafConfiguration": "Single",
  "handing": "RH",
  "hingeType": "HINGE-BT-SS-100x75",
  "hingeQty": 3,
  "lockType1": "UNION-2277",
  "masterLeafWidth": 926,
  "leafHeight": 2032,
  "visionPanelQty1": 1,
  "vp1Width": 300,
  "vp1Height": 600,
  "glassType": "Pyroguard 60-44",
  ... (all 200+ attributes as needed)
}
```

**In `QuoteLine.configuredProduct.derived.bom`:**

```json
[
  { "componentCode": "CORE-STREBORD-FD60", "qty": 1, "unit": "EA", "cost": 85.00 },
  { "componentCode": "LIPPING-OAK-8MM", "qty": 5.8, "unit": "M", "cost": 12.50 },
  { "componentCode": "HINGE-BT-SS-100x75", "qty": 3, "unit": "EA", "cost": 15.00 },
  { "componentCode": "GLASS-PYROGUARD-60-44", "qty": 0.18, "unit": "M2", "cost": 120.00 },
  { "componentCode": "INTUM-STRIP-FD60-20x4", "qty": 6.2, "unit": "M", "cost": 8.50 }
]
```

**Pros:**
- ✅ No schema migration needed
- ✅ Flexible JSON storage
- ✅ Already have BOM generation service
- ✅ Works with existing quote system

**Cons:**
- ❌ No type safety (JSON is untyped)
- ❌ No database-level validation
- ❌ Query performance issues for large datasets

---

### Option 2: Create Dedicated Fire Door Models (Recommended)

**Add to `schema.prisma`:**

```prisma
model FireDoorConfiguration {
  id              String   @id @default(cuid())
  tenantId        String
  quoteLineId     String?  @unique // Link to QuoteLine
  templateId      String?  // If saving as template
  
  // Store all attributes as typed JSON
  attributes      Json     // Validated against AttributeDefinition schema
  
  // Cached calculations
  bomSnapshot     Json?    // BOM cache
  pricingSnapshot Json?    // Pricing cache
  cutlistSnapshot Json?    // Cutlist cache
  
  // Metadata
  certificationRequired Json? // [{ code: 'CF5024', name: 'CERTIFIRE FD60' }]
  rulesApplied          Json? // Audit trail of rule evaluations
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  quoteLine       QuoteLine? @relation(fields: [quoteLineId], references: [id])
  
  @@index([tenantId])
  @@index([quoteLineId])
}
```

**Pros:**
- ✅ Dedicated table for fire doors
- ✅ Easier querying/reporting
- ✅ Cached snapshots for performance

**Cons:**
- ❌ Requires migration
- ❌ Still uses JSON for flexibility

---

## Recommendation: **Use Option 1** (No Migration)

**Rationale:**
- System already has `configuredProduct` infrastructure
- BOM generation already working
- Fire door attributes can be stored in selections JSON
- Can always add dedicated model later if needed

---

## Next Steps for Phase 2+

**After Phase 1 complete:**

1. **Create seed script** to import CSV column dictionary into `Attribute` table
2. **Build UI configurator** with grouped attribute panels
3. **Implement fire rating rules engine**
4. **Connect to existing BOM generator**
5. **Build pricing calculator**
6. **Generate workshop PDFs**
7. **Connect to 3D configurator**

---

## Summary

**What Exists:**
- ✅ Full component & BOM system in database
- ✅ 3D configurator with parametric builders
- ✅ BOM generation service with rules
- ✅ Fire door quote builder UI (but not structured)

**What's Missing:**
- ❌ Fire door attribute definitions (from CSV)
- ❌ Fire rating rules engine
- ❌ Pricing calculator
- ❌ Workshop PDF generator
- ❌ Connection between fire door spec → 3D model

**Minimal Changes Needed:**
- Use existing `configuredProduct.selections` JSON field
- Load CSV column dictionary as `Attribute` records
- Extend BOM generator with fire door rules
- Build pricing service
- Create PDF templates

**No new database tables required** - just clever use of existing infrastructure!
