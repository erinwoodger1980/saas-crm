# Fire Door Management UI - Implementation Plan

**Date:** 7 January 2026  
**Status:** 🔨 In Progress

---

## Requirements

### Core Features
1. **Spreadsheet-like Grid UI** - Excel/Google Sheets feel
2. **Import/Export** - CSV upload and download
3. **Copy/Paste** - Standard clipboard operations
4. **Filtering** - Per-column filters
5. **Column Sections** - Grouped columns (Dimensions, Materials, Ironmongery, etc.)
6. **RFI System** - Request for Information workflow
   - Flag missing data
   - Show RFIs to customers in portal
   - Track RFI status (open, answered, closed)

### Integration Points
- **Existing Fire Door Calculator** - Single door pricing
- **Fire Door Schedule** - Existing spreadsheet with tabs
- **Fire Door Pricing Service** - Backend pricing engine
- **Customer Portal** - RFI visibility for clients
- **Workshop Process Layouts** - Compatible paperwork generation

---

## Architecture

### Component Structure

```
/fire-doors (new integrated page)
  ├─ FireDoorGrid.tsx          (main spreadsheet component)
  ├─ FireDoorToolbar.tsx       (import, export, filters, RFIs)
  ├─ FireDoorRFIPanel.tsx      (RFI management sidebar)
  ├─ FireDoorCalculator.tsx    (embedded calculator for quick pricing)
  ├─ FireDoorImporter.tsx      (CSV/Excel import wizard)
  └─ hooks/
      ├─ useFireDoorData.ts    (data fetching and mutations)
      ├─ useClipboard.ts       (copy/paste handling)
      └─ useRFIs.ts            (RFI management)
```

### Database Schema

**New Table: FireDoorRFI**
```prisma
model FireDoorRFI {
  id                    String   @id @default(cuid())
  tenantId              String
  fireDoorLineItemId    String   // Links to FireDoorScheduleProject
  field                 String   // Which field has missing info
  question              String   // What info is needed
  status                String   // open, answered, closed
  priority              String   // low, medium, high, urgent
  createdBy             String   // User who raised RFI
  assignedTo            String?  // Customer contact or internal user
  response              String?
  respondedAt           DateTime?
  resolvedAt            DateTime?
  visibleToCustomer     Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  tenant                Tenant   @relation(fields: [tenantId], references: [id])
  lineItem              FireDoorScheduleProject @relation(fields: [fireDoorLineItemId], references: [id])
  creator               User     @relation("RFICreator", fields: [createdBy], references: [id])
  assignee              User?    @relation("RFIAssignee", fields: [assignedTo], references: [id])
  
  @@index([tenantId, status])
  @@index([fireDoorLineItemId])
}
```

### Column Sections

```typescript
const COLUMN_SECTIONS = [
  {
    id: 'identification',
    label: 'Identification',
    columns: ['mjsNumber', 'doorRef', 'location', 'clientOrderNo']
  },
  {
    id: 'dimensions',
    label: 'Dimensions',
    columns: ['masterLeafWidth', 'slaveLeafWidth', 'leafHeight', 'frameWidth', 'frameHeight', 'leafThickness']
  },
  {
    id: 'fire_spec',
    label: 'Fire Specification',
    columns: ['fireRating', 'coreType', 'certification', 'intumescentType']
  },
  {
    id: 'materials',
    label: 'Materials',
    columns: ['lippingMaterial', 'doorFacing', 'frameMaterial', 'glassType']
  },
  {
    id: 'ironmongery',
    label: 'Ironmongery',
    columns: ['hingeType', 'lockType', 'closerType', 'sealsType']
  },
  {
    id: 'pricing',
    label: 'Pricing',
    columns: ['materialsCost', 'labourCost', 'totalCost', 'sellPrice']
  },
  {
    id: 'production',
    label: 'Production',
    columns: ['productionStatus', 'deliveryDate', 'qrCodes']
  },
  {
    id: 'communication',
    label: 'Communication',
    columns: ['lajClientComments', 'clientComments', 'rfiCount']
  }
];
```

---

## Phase 1: Enhanced Fire Door Grid Component

### Features
- **React Window** for virtualization (handles 1000+ rows)
- **Column resizing** with drag handles
- **Column reordering** via drag-and-drop
- **Inline editing** with validation
- **Multi-select** with Shift+Click
- **Keyboard navigation** (arrow keys, Tab, Enter)
- **Context menu** (right-click options)

### Grid Library Options
1. **AG-Grid Community** (MIT license) - Excel-like, very powerful
2. **TanStack Table** + virtualization - Lightweight, flexible
3. **Glideapps Grid** - Custom solution

**Recommendation:** Use AG-Grid Community for quick Excel-like experience

---

## Phase 2: Import/Export System

### Import Flow
1. Upload CSV/Excel file
2. Map columns to fire door fields
3. Validate data (required fields, data types, fire rating rules)
4. Preview import with errors highlighted
5. Confirm and insert records
6. Auto-generate RFIs for missing critical fields

### Export Options
- **CSV** - All columns or selected columns
- **Excel** - With formatting and formulas
- **PDF** - Workshop paperwork (cutting lists, machining sheets, QA checklists)

---

## Phase 3: RFI System

### RFI Workflow

**For Internal Users:**
1. Click cell with missing/unclear data
2. Click "Raise RFI" button
3. Enter question/requirement
4. Set priority and assign to customer
5. RFI appears in customer portal

**For Customers (Portal):**
1. See list of open RFIs for their jobs
2. Click RFI to see question and context
3. Provide answer
4. Submit response
5. Internal user reviews and marks resolved

### RFI UI Components
- **RFI Badge** - Shows count on fire door row
- **RFI Panel** - Sidebar showing all RFIs for selected door
- **RFI Quick Add** - Right-click cell → "Request Info"
- **RFI Status Indicator** - Color-coded (red=urgent, amber=open, green=answered)

---

## Phase 4: Integration with Pricing Service

### Auto-Pricing Trigger
When enough fields are filled:
1. Detect complete specification
2. Call `/tenant/fire-door/calculate-price` API
3. Update pricing columns automatically
4. Show "Recalculate" button if specs change

### Bulk Pricing
- Select multiple rows
- Click "Price Selected"
- Batch process pricing for all rows
- Show progress indicator

---

## Phase 5: Workshop Paperwork Generation

### PDF Templates (compatible with existing process layouts)

**1. Production Summary**
- Job details, door specifications
- Materials required
- Ironmongery list
- Special instructions

**2. Cutting List**
- Core sizes
- Frame component lengths
- Glass dimensions
- Lipping requirements

**3. Machining Sheet**
- Hinge positions and preparation
- Lock case routing
- Closer preparation
- Seal grooves

**4. Ironmongery Schedule**
- Part numbers and quantities
- Installation instructions
- Supplier details

**5. Glazing Schedule**
- Glass type and fire rating
- Vision panel sizes and positions
- Beading specification

**6. QA Checklist**
- Fire certification requirements
- Dimensional checks
- Material verification
- Final inspection points

**7. Door Labels**
- QR codes
- Fire rating label
- Reference numbers
- Installation instructions

### Generation API
```typescript
POST /api/fire-doors/:id/generate-paperwork
{
  templates: ['production', 'cutting', 'machining', 'ironmongery', 'glazing', 'qa', 'labels'],
  format: 'pdf' | 'bundle-zip'
}

Response: {
  files: [
    { type: 'production', url: '...' },
    { type: 'cutting', url: '...' },
    ...
  ]
}
```

---

## Implementation Steps

### Step 1: Database Migration
- Add FireDoorRFI table
- Add pricing columns to FireDoorScheduleProject
- Add rfi_count computed column

### Step 2: Create Enhanced Grid Component
- Set up AG-Grid with fire door schema
- Implement column sections
- Add filtering and sorting
- Enable inline editing

### Step 3: Implement RFI System
- Create RFI API routes
- Build RFI panel component
- Add RFI indicators to grid
- Integrate with customer portal

### Step 4: Add Import/Export
- CSV parser with column mapping
- Excel export with formatting
- Validation engine
- Batch operations

### Step 5: Integrate Pricing
- Connect to fire door pricing service
- Auto-calculate on data change
- Bulk pricing operations
- Price history tracking

### Step 6: Workshop Paperwork
- PDF template engine using existing layouts
- Generate cutting lists from BOM
- Machining instructions from ironmongery
- QR code generation

---

## Next Actions

1. ✅ Create database migration for FireDoorRFI
2. ✅ Build enhanced FireDoorGrid component with AG-Grid
3. ✅ Implement RFI system (API + UI)
4. ✅ Add import/export functionality
5. ✅ Integrate fire door pricing service
6. ✅ Generate workshop paperwork PDFs

---

## Technical Stack

- **Grid:** AG-Grid Community Edition
- **State:** React Query + Zustand
- **Forms:** React Hook Form + Zod validation
- **PDF:** PDFKit or Puppeteer
- **Export:** xlsx library for Excel
- **Import:** papaparse for CSV

---

## Expected Timeline

- **Phase 1** (Grid): 2-3 days
- **Phase 2** (Import/Export): 1-2 days  
- **Phase 3** (RFI System): 2 days
- **Phase 4** (Pricing): 1 day
- **Phase 5** (Paperwork): 2-3 days

**Total:** 8-11 days for complete implementation

---

## Success Criteria

✅ Users can import existing fire door schedules  
✅ Spreadsheet feels like Excel (copy/paste, keyboard nav)  
✅ RFIs visible to customers in portal  
✅ Automatic pricing when specifications complete  
✅ Workshop paperwork compatible with existing processes  
✅ 1000+ door records load performantly  
✅ Data validation prevents invalid configurations  
✅ Export maintains data integrity
