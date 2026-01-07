# Fire Door Configurator System - Comprehensive Implementation Plan

**Last Updated:** 7 January 2026  
**Data Sources:**
- Paul's Quote List Explained.csv (200+ column dictionary with descriptions)
- Costings for Copilot.xls (26 sheets: pricing, certification, production data)
- Existing system infrastructure analysis

---

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
- Need structured mapping from Paul's CSV columns (A-GZ, 200+ columns) to attribute definitions
- Need fire rating rules (FD30/FD60/FD90/FD120 → component requirements)
- Need certification tracking from "Fire Certification" sheets (116 rows ASPEX + 122 rows standard)
- Need seal requirements (intumescent, smoke, acoustic)

**CSV Column Mappings:**
- **CRITICAL INSIGHT:** Paul's Excel shows actual production data (598 rows × 256 columns) with real configurations
- Product Codes sheet has 110 predefined doorset types (FD001-FD110+)
- Leaf Sizing By Frame Type sheet (63 rows) provides dimensional formulas
- Need dropdown options for all enumerated fields (handing, frame type, action, etc.)
- Need validation rules for each attribute

#### 2. **Pricing Engine**

**Excel file contains complete pricing data:**
- **Door Core Prices** sheet (137 rows): Core material costs by thickness and type
- **Timber Prices** sheet (52 rows): Lipping, stiles, rails, and veneer costs
- **Glass Prices** sheet (58 rows): Fire-rated glass by type and size
- **Leaf_Frame Finishes** sheet (105 rows): Finish costs (lacquer, veneer, PVC wrap)
- **Veneer Layon Prices 2024** sheet (79 rows): Veneer overlay pricing
- **Ironmongery** sheet (70 rows): Hardware component costs
- **Lathams** sheet (413 rows): Full supplier price list
- **Weights** sheet (26 rows): Component weights for shipping calculations

**Need to build:**
- Pricing calculator that references these Excel sheets
- Material cost = sum(BOM qty × unit cost from Excel lookup)
- Labour cost = sum(operation minutes × shop rate)
- Overhead allocation
- Margin calculation
- Explainability (why was this component included?)

#### 3. **Workshop Paperwork Generator**

**No PDF generation for:**
- Production summary sheet (from Woodge Export sheets - 598 rows with 126-256 production columns)
- Cutting list (profile lengths, panel dims from Door Production sheet)
- Machining sheet (hinge prep, lock case, closers, seals)
- Ironmongery schedule (brand/model + quantities from Ironmongery Intu Packs - 51 rows)
- Glazing schedule (glass spec + sizes from Glass Prices - 58 rows)
- QA checklist (from Fire Certification Check sheet - 122 validation rows)
- Door labels (ref, rating, handing, dims)
- Shopping Lists sheet (21 rows) - material procurement

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
- Sidelight/toplight generation (from columns BX-CN: fanlights and sidelights 1-4)

---

## Phase 1: CSV & Excel Data Integration

### Step 1: Analyze Paul's Column Dictionary + Excel Data

**Primary Data Sources:**

#### A. **Paul's Quote List Explained.csv**
- **200+ columns** (A through GZ) with detailed descriptions
- Column explanations include:
  - Component affected (e.g., "Door Blank & Frame")
  - Impact on system (e.g., "affects core type, glass type, intumescent type, certification")
  - UI requirements (e.g., "Dropdown Box", "Auto fills", "Required if...")
  - Default values and validation rules
  - Calculation formulas and dependencies

#### B. **Costings for Copilot.xls - 26 Sheets**

**Production Data:**
1. **Woodge Export (Production)** - 598 rows × 126 columns
   - Real fire door configurations
   - Fields: LAJ REF, DOOR REF, MASTER WIDTH, SLAVE WIDTH, DOOR HEIGHT
   - RATING (FD30/60/90/120), CORE TYPE, LIPPING DETAIL
   - HINGING, POSITION, QTY OF HINGES, HINGE TYPE
   - LOCK TYPE, SPINDLE PREP, CYLINDER PREP, LOCK HEIGHT
   - VISION PANEL specs, BEAD TYPE, VP POSITION
   - FRAME TYPE, MATERIAL, WIDTH, HEAD, EXTENSION, JAMBS
   - FRAME FINISH, FRAME HEIGHT, FRAME WIDTH
   - INTUMESCENT TYPE, INTUMESCENT ARRANGEMENT

2. **Woodge Export** - 598 rows × 256 columns (full export)
   - Extended production data with additional columns

**Pricing Reference Data:**
3. **Door Core Prices** - 137 rows
   - Columns: Core Type, Thickness, Price, Supplier, Fire Rating
   - Examples: Strebord_MDF_Faced44 (£22.00), Halspan_Optima54 (£33.50)

4. **Timber Prices** - 52 rows
   - Veneer types: Oak (£720/m³), Ash (£710/m³), Walnut (£640/m³)
   - Acoustic laminations: 6.8mm (£17.00/m²)

5. **Glass Prices** - 58 rows
   - Fire-rated glass by type, thickness, and rating
   - Pyroguard, Pilkington Pyrostop variants

6. **Leaf_Frame Finishes** - 105 rows
   - Finish options: Lacquer, PVC Wrap, Veneer
   - Cost by finish type and material

7. **Veneer Layon Prices 2024** - 79 rows
   - Veneer overlay pricing by species and grade

8. **Ironmongery** - 70 rows
   - Hardware catalog: hinges, locks, closers, seals
   
9. **Ironmongery Intu Packs** - 51 rows
   - Intumescent packs by fire rating

10. **Lathams** - 413 rows (+ 74 rows with 20% adjustment)
    - Full supplier price list

11. **Weights** - 26 rows
    - Component weights for logistics

**Certification Data:**
12. **Fire Certification** - 116 rows
    - Core fire rating certifications

13. **Fire Certification Check** - 122 rows
    - Validation and compliance rules

14. **Fire Certification ASPEX** - 108 rows
    - ASPEX-specific certification data

**Configuration Data:**
15. **Product Codes** - 110 rows
    - Predefined doorset configurations (FD001-FD110+)
    - Columns: Code, Description, Type, Number of Leaves, Frame, Fanlight, Sidelight
    - Example: FD001 = "Concealed - Double - Without Frame"
    - Includes lipping style conditions, frame type requirements

16. **Leaf Sizing By Frame Type** - 63 rows
    - Dimensional formulas by frame configuration
    - Opening types: Single Action, Double Action, Leaf & a Half, Double, Split, etc.

17. **Door Production** - 4 rows
    - Production setup configurations

18. **Frame Sheet** - 3 rows
    - Frame construction templates

**Supporting Data:**
19. **Cost Sheet** - 641 rows (main costing calculations)
20. **Line By Line Fill** - 72 rows (line item templates)
21. **Shopping Lists** - 21 rows (material procurement)
22. **Lists** - 22 rows (reference lists)
23. **Data**, **Row**, **Import** sheets - Supporting/empty sheets

---

### Step 2: Complete Column Mapping (200+ Columns)

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

---

## Phase 2: Pricing Engine Implementation

### Architecture: Excel Data → Database Import

**Strategy:** Import Excel pricing data into existing `ComponentLookup` and `Material` tables

#### Import Flow:

```typescript
// 1. Parse Excel sheets
const pricingData = {
  cores: parseSheet('Door Core Prices'), // 137 rows
  timber: parseSheet('Timber Prices'),    // 52 rows
  glass: parseSheet('Glass Prices'),      // 58 rows
  finishes: parseSheet('Leaf_Frame Finishes'), // 105 rows
  ironmongery: parseSheet('Ironmongery'), // 70 rows
  veneers: parseSheet('Veneer Layon Prices 2024'), // 79 rows
  lathams: parseSheet('Lathams'), // 413 rows
};

// 2. Create ComponentLookup records
await prisma.componentLookup.createMany({
  data: pricingData.cores.map(row => ({
    componentType: 'CORE',
    code: row['Core Type'], // e.g., 'Strebord_MDF_Faced44'
    name: row['Description'],
    basePrice: row['Price'],
    unit: 'EA',
    attributes: {
      thickness: row['Thickness'],
      fireRating: row['Fire Rating'],
      supplier: row['Supplier'],
      density: row['Density (kg/m³)'],
    }
  }))
});

// 3. Create Material records for timber
await prisma.material.createMany({
  data: pricingData.timber.map(row => ({
    name: row['Species'],
    category: 'TIMBER',
    pricePerUnit: row['Price per m³'],
    unit: 'M3',
    supplier: 'Lathams',
    attributes: {
      grade: row['Grade'],
      acousticRating: row['Acoustic (dB)'],
    }
  }))
});
```

### Pricing Calculator Service

**File:** `api/src/services/fire-door-pricing.ts`

```typescript
interface PricingBreakdown {
  materials: {
    core: { qty: number; unitCost: number; total: number };
    lipping: { qty: number; unitCost: number; total: number };
    glass: { qty: number; unitCost: number; total: number };
    facing: { qty: number; unitCost: number; total: number };
    ironmongery: { item: string; qty: number; unitCost: number; total: number }[];
    frame: { qty: number; unitCost: number; total: number };
  };
  labour: {
    cutting: { minutes: number; rate: number; total: number };
    edgeBanding: { minutes: number; rate: number; total: number };
    machining: { minutes: number; rate: number; total: number };
    assembly: { minutes: number; rate: number; total: number };
    finishing: { minutes: number; rate: number; total: number };
  };
  overhead: number;
  subtotal: number;
  margin: number;
  totalPrice: number;
}

class FireDoorPricingService {
  async calculatePrice(config: FireDoorConfig): Promise<PricingBreakdown> {
    // 1. Lookup core price from ComponentLookup
    const core = await this.lookupCore(config.coreType, config.leafThickness);
    const coreQty = config.leafCount; // 1 core per leaf
    const coreCost = core.basePrice * coreQty;
    
    // 2. Calculate lipping cost
    const lippingPerimeter = (config.masterLeafWidth + config.leafHeight) * 2;
    if (config.slaveLeafWidth) {
      lippingPerimeter += (config.slaveLeafWidth + config.leafHeight) * 2;
    }
    const lippingQty = lippingPerimeter / 1000; // Convert mm to m
    const lippingMaterial = await this.lookupTimber(config.lippingMaterial);
    const lippingCost = lippingQty * lippingMaterial.pricePerMetre;
    
    // 3. Calculate glass cost (if vision panels)
    let glassCost = 0;
    if (config.visionPanelQty1 > 0) {
      const glassArea = (config.vp1Width * config.vp1Height) / 1000000; // mm² to m²
      const glassPrice = await this.lookupGlass(config.glassType, config.fireRating);
      glassCost = glassArea * config.visionPanelQty1 * glassPrice.pricePerM2;
    }
    
    // 4. Calculate facing cost
    const leafArea = (config.masterLeafWidth * config.leafHeight) / 1000000; // mm² to m²
    const facingArea = leafArea * 2 * config.leafCount; // Both sides, all leaves
    const facingMaterial = await this.lookupFinish(config.doorFacing, config.doorFinishSide1);
    const facingCost = facingArea * facingMaterial.pricePerM2;
    
    // 5. Calculate ironmongery cost
    const ironmongeryCosts = [];
    if (config.hingeSupplyType === 'Supplied') {
      const hinge = await this.lookupIronmongery(config.hingeType);
      ironmongeryCosts.push({
        item: config.hingeType,
        qty: config.hingeQty,
        unitCost: hinge.basePrice,
        total: hinge.basePrice * config.hingeQty
      });
    }
    // ... repeat for locks, bolts, closers, etc.
    
    // 6. Calculate labour costs
    const labourTimes = await this.calculateLabourMinutes(config);
    const shopRate = 45; // £45/hour = £0.75/minute
    const labourCost = Object.values(labourTimes).reduce((sum, mins) => {
      return sum + (mins * (shopRate / 60));
    }, 0);
    
    // 7. Calculate overhead (15% of materials + labour)
    const materialSubtotal = coreCost + lippingCost + glassCost + facingCost + 
      ironmongeryCosts.reduce((sum, item) => sum + item.total, 0);
    const overhead = (materialSubtotal + labourCost) * 0.15;
    
    // 8. Apply margin (25% markup)
    const subtotal = materialSubtotal + labourCost + overhead;
    const margin = subtotal * 0.25;
    const totalPrice = subtotal + margin;
    
    return {
      materials: {
        core: { qty: coreQty, unitCost: core.basePrice, total: coreCost },
        lipping: { qty: lippingQty, unitCost: lippingMaterial.pricePerMetre, total: lippingCost },
        glass: { qty: glassArea, unitCost: glassPrice.pricePerM2, total: glassCost },
        facing: { qty: facingArea, unitCost: facingMaterial.pricePerM2, total: facingCost },
        ironmongery: ironmongeryCosts,
        frame: { ... }
      },
      labour: labourTimes,
      overhead,
      subtotal,
      margin,
      totalPrice
    };
  }
  
  private async lookupCore(coreType: string, thickness: number) {
    return await prisma.componentLookup.findFirst({
      where: {
        componentType: 'CORE',
        code: { contains: coreType },
        attributes: { path: ['thickness'], equals: thickness }
      }
    });
  }
  
  private async calculateLabourMinutes(config: FireDoorConfig) {
    // Base times from historical data
    const baseTimes = {
      cutting: 15, // minutes per core
      edgeBanding: 20, // minutes per leaf
      machining: 30, // base machining time
      assembly: 45,
      finishing: config.doorFacing === 'Paint' ? 60 : 30
    };
    
    // Adjust for complexity
    if (config.visionPanelQty1 > 0) {
      baseTimes.machining += 20 * config.visionPanelQty1;
    }
    if (config.lockType1) {
      baseTimes.machining += 15;
    }
    if (config.lockType2) {
      baseTimes.machining += 15;
    }
    
    return baseTimes;
  }
}
```

### Excel Import Script

**File:** `scripts/import-fire-door-pricing.ts`

```typescript
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importPricingData() {
  const workbook = XLSX.readFile('Costings for Copilot.xls');
  
  // Import Door Core Prices
  const coreSheet = workbook.Sheets['Door Core Prices'];
  const coreData = XLSX.utils.sheet_to_json(coreSheet);
  
  for (const row of coreData) {
    await prisma.componentLookup.upsert({
      where: { code: row['Core Type'] },
      create: {
        tenantId: 'YOUR_TENANT_ID',
        componentType: 'CORE',
        code: row['Core Type'],
        name: row['Description'],
        basePrice: row['Price'],
        unit: 'EA',
        attributes: {
          thickness: row['Thickness'],
          fireRating: row['Fire Rating'],
          supplier: row['Supplier'],
        }
      },
      update: {
        basePrice: row['Price'],
      }
    });
  }
  
  console.log('✅ Imported Door Core Prices');
  
  // Import Timber Prices
  const timberSheet = workbook.Sheets['Timber Prices'];
  const timberData = XLSX.utils.sheet_to_json(timberSheet);
  
  for (const row of timberData) {
    await prisma.material.upsert({
      where: { 
        tenantId_name: {
          tenantId: 'YOUR_TENANT_ID',
          name: row['Species']
        }
      },
      create: {
        tenantId: 'YOUR_TENANT_ID',
        name: row['Species'],
        category: 'TIMBER',
        pricePerUnit: row['Price per m³'],
        unit: 'M3',
        supplier: 'Lathams',
      },
      update: {
        pricePerUnit: row['Price per m³'],
      }
    });
  }
  
  console.log('✅ Imported Timber Prices');
  
  // ... repeat for Glass Prices, Finishes, Ironmongery, etc.
}

importPricingData()
  .then(() => console.log('✅ All pricing data imported'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Phase 3: Fire Rating Rules Engine

### Certification Data Integration

**From Excel sheets:**
- Fire Certification (116 rows)
- Fire Certification Check (122 rows)  
- Fire Certification ASPEX (108 rows)

### Rules Engine Implementation

**File:** `api/src/services/fire-rating-rules.ts`

```typescript
interface FireRatingRule {
  coreType: string;
  minLeafThickness: number;
  intumescentStrip: string;
  intumescentThickness: string; // e.g., "15x4mm", "20x4mm"
  glassBead: string;
  glassTypes: string[];
  maxGlazedArea?: number; // m² or percentage
  certification: string[];
  restrictions: {
    frameMaterial?: { exclude: string[] };
    letterPlate?: boolean;
    doorViewer?: boolean;
    action?: string[]; // Allowed actions
    maxLeafWidth?: number;
    maxLeafHeight?: number;
  };
}

const FIRE_RATING_RULES: Record<string, FireRatingRule> = {
  'FD30': {
    coreType: 'Strebord FD30',
    minLeafThickness: 44,
    intumescentStrip: 'Lorient 15x4mm',
    intumescentThickness: '15x4mm',
    glassBead: 'Timber Non-Intumescent',
    glassTypes: [
      'Pyroguard 30-32',
      'Pilkington Pyrostop 30-16',
      'Pyrobelite 7-16',
    ],
    maxGlazedArea: 0.5, // 50% of door area
    certification: [
      'CERTIFIRE CF5023',
      'BWF-CERTIFIRE FDIS001',
      'ASPEX A/042920',
    ],
    restrictions: {
      letterPlate: true,
      doorViewer: true,
      action: ['Single', 'Double', 'Sliding', 'Anti Barricade'],
    },
  },
  
  'FD60': {
    coreType: 'Strebord FD60',
    minLeafThickness: 54,
    intumescentStrip: 'Lorient 20x4mm',
    intumescentThickness: '20x4mm',
    glassBead: 'Intumescent Glazing Bead',
    glassTypes: [
      'Pyroguard 60-44',
      'Pilkington Pyrostop 60-32',
      'Schott Pyran S 60',
    ],
    maxGlazedArea: 0.4, // 40% of door area
    certification: [
      'CERTIFIRE CF5024',
      'BWF-CERTIFIRE FDIS002',
      'ASPEX A/042921',
    ],
    restrictions: {
      frameMaterial: {
        exclude: ['Softwood', 'Beech'], // Must use Maple-Beech Stained or Hardwood
      },
      letterPlate: false, // NOT permitted
      doorViewer: false,  // NOT permitted
      action: ['Single', 'Double'], // No sliding for FD60
      maxLeafWidth: 1200,
      maxLeafHeight: 2400,
    },
  },
  
  'FD90': {
    coreType: 'Halspan FD90',
    minLeafThickness: 64,
    intumescentStrip: 'Lorient 25x4mm',
    intumescentThickness: '25x4mm',
    glassBead: 'Intumescent Glazing Bead',
    glassTypes: [
      'Pyroguard 90-64',
      'Pilkington Pyrostop 90-52',
    ],
    maxGlazedArea: 0.3, // 30% of door area
    certification: [
      'CERTIFIRE CF5025',
      'ASPEX A/042922',
    ],
    restrictions: {
      frameMaterial: {
        exclude: ['Softwood', 'Beech', 'MDF'],
      },
      letterPlate: false,
      doorViewer: false,
      action: ['Single', 'Double'],
      maxLeafWidth: 1100,
      maxLeafHeight: 2300,
    },
  },
  
  'FD120': {
    coreType: 'Halspan FD120',
    minLeafThickness: 60,
    intumescentStrip: 'Lorient 25x4mm Double',
    intumescentThickness: '25x4mm (double)',
    glassBead: 'Intumescent Glazing Bead',
    glassTypes: [
      'Pyroguard 120-88',
    ],
    maxGlazedArea: 0.25, // 25% of door area
    certification: [
      'CERTIFIRE CF5026',
    ],
    restrictions: {
      frameMaterial: {
        exclude: ['Softwood', 'Beech', 'MDF'],
      },
      letterPlate: false,
      doorViewer: false,
      action: ['Single'], // Only single action for FD120
      maxLeafWidth: 1000,
      maxLeafHeight: 2200,
    },
  },
};

export class FireRatingRulesEngine {
  validate(config: FireDoorConfig): ValidationResult {
    if (!config.fireRating || config.fireRating === 'None') {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const rules = FIRE_RATING_RULES[config.fireRating];
    if (!rules) {
      return {
        valid: false,
        errors: [`Unknown fire rating: ${config.fireRating}`],
        warnings: [],
      };
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check leaf thickness
    if (config.leafThickness < rules.minLeafThickness) {
      errors.push(
        `Leaf thickness ${config.leafThickness}mm is below minimum ${rules.minLeafThickness}mm for ${config.fireRating}`
      );
    }
    
    // Check core type
    if (config.coreType !== rules.coreType) {
      warnings.push(
        `Core type should be ${rules.coreType} for ${config.fireRating} (currently: ${config.coreType})`
      );
    }
    
    // Check glass type
    if (config.visionPanelQty1 > 0) {
      if (!rules.glassTypes.includes(config.glassType)) {
        errors.push(
          `Glass type ${config.glassType} is not certified for ${config.fireRating}. ` +
          `Permitted types: ${rules.glassTypes.join(', ')}`
        );
      }
      
      // Check glazed area
      const leafArea = (config.masterLeafWidth * config.leafHeight) / 1000000; // m²
      const glazedArea = (config.vp1Width * config.vp1Height) / 1000000; // m²
      const glazedPercentage = glazedArea / leafArea;
      
      if (glazedPercentage > rules.maxGlazedArea) {
        errors.push(
          `Glazed area ${(glazedPercentage * 100).toFixed(1)}% exceeds maximum ` +
          `${(rules.maxGlazedArea * 100).toFixed(1)}% for ${config.fireRating}`
        );
      }
    }
    
    // Check frame material restrictions
    if (rules.restrictions.frameMaterial?.exclude.includes(config.frameMaterial)) {
      errors.push(
        `Frame material ${config.frameMaterial} is not permitted for ${config.fireRating}. ` +
        `Excluded materials: ${rules.restrictions.frameMaterial.exclude.join(', ')}`
      );
    }
    
    // Check letter plate
    if (config.letterPlate && rules.restrictions.letterPlate === false) {
      errors.push(`Letter plate is not permitted for ${config.fireRating}`);
    }
    
    // Check door viewer
    if (config.doorViewer && rules.restrictions.doorViewer === false) {
      errors.push(`Door viewer is not permitted for ${config.fireRating}`);
    }
    
    // Check action type
    if (!rules.restrictions.action?.includes(config.action)) {
      errors.push(
        `Action type ${config.action} is not permitted for ${config.fireRating}. ` +
        `Permitted actions: ${rules.restrictions.action.join(', ')}`
      );
    }
    
    // Check dimensions
    if (rules.restrictions.maxLeafWidth && config.masterLeafWidth > rules.restrictions.maxLeafWidth) {
      errors.push(
        `Leaf width ${config.masterLeafWidth}mm exceeds maximum ${rules.restrictions.maxLeafWidth}mm for ${config.fireRating}`
      );
    }
    
    if (rules.restrictions.maxLeafHeight && config.leafHeight > rules.restrictions.maxLeafHeight) {
      errors.push(
        `Leaf height ${config.leafHeight}mm exceeds maximum ${rules.restrictions.maxLeafHeight}mm for ${config.fireRating}`
      );
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      certification: rules.certification,
    };
  }
  
  applyAutoCorrections(config: FireDoorConfig): FireDoorConfig {
    if (!config.fireRating || config.fireRating === 'None') {
      return config;
    }
    
    const rules = FIRE_RATING_RULES[config.fireRating];
    if (!rules) return config;
    
    return {
      ...config,
      coreType: rules.coreType,
      leafThickness: Math.max(config.leafThickness || 0, rules.minLeafThickness),
      intumescentStrip: rules.intumescentStrip,
      glassBead: config.visionPanelQty1 > 0 ? rules.glassBead : config.glassBead,
    };
  }
}
```

---

## Phase 4: Workshop Paperwork PDF Generation

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
