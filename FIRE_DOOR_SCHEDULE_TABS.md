# Fire Door Schedule - Phase-Based Tab System

## Overview

The Fire Door Schedule now uses **phase-based tabs** that organize project fields by workflow stage, replacing the previous workflow-filter tabs. Each tab displays different columns relevant to that project phase while maintaining context with MJS# and Job Name.

## Tab Structure

### 1. **Project Overview**
High-level project information and status.

**Columns:**
- MJS# (unique identifier)
- Job Name (project title)
- Client (customer name)
- PO (purchase order number)
- Received (date received in red folder)
- Required (client deadline date)
- Location (RED FOLDER / IN PROGRESS / COMPLETE)
- Progress (overall % completion with visual bar)

**Use case:** Quick overview of all projects with key identifiers and dates.

---

### 2. **Design & Sign Off**
Design and approval workflow tracking.

**Columns:**
- MJS#
- Job Name
- Sign Off (status dropdown: NOT LOOKED AT / AWAITING SCHEDULE / WORKING ON SCHEDULE / SCHEDULE SENT FOR SIGN OFF / SCHEDULE SIGNED OFF)
- Scheduled By (dropdown: DARREN / DAVE / STEVE / PAUL / DAN)
- Signed Off (date when schedule was signed off)
- Lead Time (weeks) (number input)
- Approx Delivery (calculated delivery date)

**Use case:** Track design review and sign-off process with assigned designers.

---

### 3. **BOM & Materials**
Bill of Materials and material ordering status.

**Columns:**
- MJS#
- Job Name
- Ordering (status dropdown: NOT IN BOM / IN BOM TBC / IN BOM / STOCK / ORDERED / RECEIVED / ORDERED CALL OFF / MAKE IN HOUSE / N/A)
- Blanks (status dropdown: STOCK / ORDERED / RECEIVED / N/A / URGENT)
- Lippings (status dropdown)
- Facings (status dropdown)
- Glass (status dropdown)
- Ironmongery (status dropdown)

**Use case:** Material procurement tracking for all door components.

---

### 4. **Production Process**
Manufacturing progress tracking with percentages.

**Columns:**
- MJS#
- Job Name
- Blanks Cut % (0-100 with progress bar)
- Edgeband % (0-100 with progress bar)
- Calibrate % (0-100 with progress bar)
- Facings % (0-100 with progress bar)
- Spray % (0-100 with progress bar)
- Build % (0-100 with progress bar)
- Progress (overall % with progress bar)

**Use case:** Monitor production stages through the manufacturing pipeline.

---

### 5. **Delivery & Installation**
Delivery tracking and installation management.

**Columns:**
- MJS#
- Job Name
- Transport (transport status dropdown)
- Delivery (actual delivery date)
- Install Start (installation start date)
- Install End (installation completion date)
- Snagging (snagging list status dropdown)
- Snagging Done (checkbox - snagging completed)

**Use case:** Track delivery logistics and post-installation issues.

---

### 6. **Notes & Communication**
Communication logs and project notes.

**Columns:**
- MJS#
- Job Name
- Client (for context)
- Communication (communication notes - text area)
- Internal Notes (internal team notes - text area)
- Paperwork Notes (paperwork comments - text area)
- Updated By (who last modified)
- Updated At (timestamp - read-only)

**Use case:** Maintain communication history and internal documentation.

---

## Features

### Dynamic Column Rendering
Each tab automatically displays only relevant fields using the `renderCell()` function which detects field types:

- **Date fields** → Date input picker
- **Percentage fields** → Progress bar + number input (0-100)
- **Boolean fields** → Checkbox
- **Status fields** → Dropdown with predefined options
- **Text fields** → Text input (default)
- **Timestamp fields** → Read-only formatted display

### Inline Editing
All fields (except read-only ones like `lastUpdatedAt`) support inline editing with:
- Optimistic UI updates (instant feedback)
- PATCH API calls to `/fire-door-schedule/:id`
- Auto-reload on failure for data consistency

### Persistent State
All UI preferences are saved to `localStorage`:
- `fds:view` - Table or card view
- `fds:activeTab` - Selected tab (PROJECT_OVERVIEW, DESIGN_SIGN_OFF, etc.)
- `fds:location` - Location filter (from stats cards)
- `fds:sortField` - Current sort column
- `fds:sortDir` - Sort direction (asc/desc)

### Sorting
All columns are sortable by clicking headers:
- Active sort shows up/down arrow
- Inactive columns show hover arrow
- Supports ascending/descending toggle

### Filtering
Two-level filtering system:
1. **Location Filter** (from clickable stats cards): RED FOLDER / IN PROGRESS / COMPLETE / ALL
2. **Tab Organization** (non-filtering): Each tab shows ALL projects but with different columns

---

## Technical Implementation

### Tab Definitions
```typescript
const TAB_DEFINITIONS = {
  PROJECT_OVERVIEW: {
    label: 'Project Overview',
    columns: ['mjsNumber', 'jobName', 'clientName', 'poNumber', 'dateReceived', 'dateRequired', 'jobLocation', 'overallProgress']
  },
  DESIGN_SIGN_OFF: {
    label: 'Design & Sign Off',
    columns: ['mjsNumber', 'jobName', 'signOffStatus', 'scheduledBy', 'signOffDate', 'leadTimeWeeks', 'approxDeliveryDate']
  },
  // ... etc
};
```

### Column Labels
```typescript
const COLUMN_LABELS: Record<string, string> = {
  mjsNumber: 'MJS#',
  jobName: 'Job Name',
  clientName: 'Client',
  // ... etc
};
```

### Cell Renderer
The `renderCell(project, field)` function automatically determines the appropriate input type based on field name patterns:
- Fields with "date" or "Date" → date input
- Fields with "Percent" or `overallProgress` → progress bar
- Fields with "Checked" or "Complete" → checkbox
- Specific status fields → dropdown with options
- Everything else → text input

---

## Usage Guidelines

### When to Use Each Tab

1. **Start with Project Overview** for initial project setup and overview
2. **Move to Design & Sign Off** when working on schedule approvals
3. **Use BOM & Materials** when ordering components
4. **Track Production Process** during manufacturing
5. **Monitor Delivery & Installation** for logistics and post-delivery
6. **Reference Notes & Communication** for history and documentation

### Best Practices

- Always fill in **MJS#** and **Job Name** (shown in all tabs)
- Use **Location** filter in stats cards to focus on specific project stages
- Update **Progress** percentages in Production Process tab regularly
- Document important communications in Notes & Communication tab
- Keep **Sign Off** status current for design workflow visibility

---

## Database Schema Reference

All fields map to the `FireDoorScheduleProject` model in `api/prisma/schema.prisma` (line 2737).

Key field groups:
- **Overview & Identification** (lines 2745-2752)
- **Design & Sign-Off** (lines 2754-2761)
- **BOM & Ordering** (lines 2763-2782)
- **Production & Capacity** (lines 2784-2797)
- **Paperwork & Certification** (lines 2799-2806)
- **Delivery & Installation** (lines 2808-2815)
- **Communication & Notes** (lines 2817-2821)

---

## Migration from Old System

The previous tab system was workflow-based (Paperwork/BOM/Manufacturing/Complete) with filtering logic. The new system:

✅ **Organizes** data by phase (no filtering by tab)  
✅ **Shows** all projects in every tab (filter by location instead)  
✅ **Displays** phase-relevant columns dynamically  
✅ **Maintains** inline editing for all field types  
✅ **Preserves** sorting and location filtering functionality  

No data migration needed - only UI reorganization.
