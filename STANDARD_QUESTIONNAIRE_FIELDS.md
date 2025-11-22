# Standard Questionnaire Fields for ML Training

## Overview

To ensure consistent ML training across all tenants, we define **standard questionnaire fields** that:
1. Are automatically created for every tenant
2. Cannot be deleted (only hidden if truly not needed)
3. Map directly to ML training features via `costingInputKey`
4. Provide a consistent feature set for the RandomForest model

Tenants can **add custom fields** beyond these standards for their specific workflow needs.

---

## Standard Field Definitions

These fields are flagged with `isStandard: true` in the database.

### Core Project Fields

| Key | Label | Type | Required | ML Feature | Purpose |
|-----|-------|------|----------|------------|---------|
| `area_m2` | Project Area (m²) | number | Yes | `area_m2` | Total area for pricing calculations |
| `materials_grade` | Materials Grade | select | Yes | `materials_grade` | Premium/Standard/Basic timber quality |
| `project_type` | Project Type | select | Yes | `project_type` | Windows/Doors/Staircase/Kitchen/etc. |
| `glazing_type` | Glazing Type | select | No | `glazing_type` | Standard/Triple/Vacuum glass specification |
| `has_curves` | Curved/Arched Design | boolean | No | `has_curves` | Curved or arched elements (premium pricing) |

### Window-Specific Fields

| Key | Label | Type | Required | ML Feature | Purpose |
|-----|-------|------|----------|------------|---------|
| `window_style` | Window Style | select | No | `window_style` | Casement/Sash/Fixed/etc. |
| `num_windows` | Number of Windows | number | No | `quantity` | Count of window units |

### Door-Specific Fields

| Key | Label | Type | Required | ML Feature | Purpose |
|-----|-------|------|----------|------------|---------|
| `door_type` | Door Type | select | No | `door_type` | External/Internal/Bifold/French |
| `door_height_mm` | Door Height (mm) | number | No | `door_height_mm` | Height in millimeters |
| `door_width_mm` | Door Width (mm) | number | No | `door_width_mm` | Width in millimeters |
| `num_doors` | Number of Doors | number | No | `quantity` | Count of door units |

### Premium Features

| Key | Label | Type | Required | ML Feature | Purpose |
|-----|-------|------|----------|------------|---------|
| `premium_hardware` | Premium Hardware | boolean | No | `premium_hardware` | Upgraded handles/locks/hinges |
| `custom_finish` | Custom Finish | select | No | `custom_finish` | None/Paint/Stain/Lacquer |
| `fire_rated` | Fire Rated | boolean | No | `fire_rated` | Fire door certification required |
| `installation_required` | Installation Required | boolean | No | `installation_required` | Professional installation needed |

### Contact & Context

| Key | Label | Type | Required | ML Feature | Purpose |
|-----|-------|------|----------|------------|---------|
| `contact_name` | Your Name | text | Yes | - | Customer identification |
| `email` | Email | text | Yes | - | Contact information |
| `phone` | Phone | text | No | - | Contact information |
| `lead_source` | How did you hear about us? | select | No | `lead_source` | Website/Referral/Google/etc. |
| `region` | Project Location | select | No | `region` | Geographic location for pricing |
| `property_listed` | Listed Building | boolean | No | `property_listed` | Property is a listed building |
| `timeframe` | Project Timeframe | select | No | - | ASAP/1-2 months/3-6 months |
| `budget_range` | Budget Range | select | No | - | Under 5k/5-15k/15k+/Flexible |

---

## Implementation Plan

### Phase 1: Schema Update

Add `isStandard` flag to `QuestionnaireField`:

```prisma
model QuestionnaireField {
  // ... existing fields
  isStandard Boolean @default(false) // True for system-defined ML training fields
  isHidden   Boolean @default(false) // Allow hiding standard fields if not relevant
}
```

### Phase 2: Seed Standard Fields

Create utility to seed standard fields for all tenants:

**Location**: `/api/src/lib/standardQuestionnaireFields.ts`

```typescript
export const STANDARD_FIELDS = [
  {
    key: "area_m2",
    label: "Project Area (m²)",
    type: "NUMBER",
    required: true,
    costingInputKey: "area_m2",
    helpText: "Total area of project in square meters",
    sortOrder: 0,
    isStandard: true
  },
  {
    key: "materials_grade",
    label: "Materials Grade",
    type: "SELECT",
    options: ["Premium", "Standard", "Basic"],
    required: true,
    costingInputKey: "materials_grade",
    helpText: "Quality tier of materials",
    sortOrder: 1,
    isStandard: true
  },
  // ... rest of standard fields
];
```

### Phase 3: Migration Script

Create migration to:
1. Add `isStandard` and `isHidden` columns
2. Seed standard fields for existing tenants
3. Update ML training to prioritize standard fields

### Phase 4: UI Updates

**Admin Settings**:
- Show standard fields in separate section (cannot delete, only hide)
- Allow adding custom fields below standard fields
- Badge indicating "Standard (ML Training)" vs "Custom"

**Questionnaire Form**:
- Render standard fields first (unless hidden)
- Group by category: Project Details → Windows → Doors → Premium Features → Contact
- Show custom fields at end

### Phase 5: ML Training Enhancement

Update ML training code to:
1. Always extract standard field values from `parsed_data.questionnaire_answers`
2. Use fallback values if standard fields missing from older data
3. Include custom fields as optional features (if present in enough samples)

---

## Benefits

### For ML Training
- **Consistent feature set** across all tenants
- **Better model accuracy** with standardized inputs
- **Easier model updates** when adding new features
- **Cross-tenant learning** (optional) using normalized features

### For Tenants
- **Quick setup** with pre-configured ML-optimized questions
- **Flexibility** to add business-specific questions
- **Better estimates** from day one without custom configuration
- **Guided best practices** for data collection

### For PDF Parsing
- Parser can target standard field keys when extracting from invoices
- Consistent mapping: "Vacuum Glass" → `glazing_type: "Vacuum Glass"`
- Better training data quality with normalized values

---

## Conditional Logic (Future)

Standard fields can enable smart conditional display:

```typescript
// Only show door fields if project_type includes "Doors"
if (project_type === "Doors" || project_type === "French Doors") {
  show: ["door_type", "door_height_mm", "door_width_mm", "num_doors"]
}

// Only show window fields if project_type includes "Windows"
if (project_type === "Windows" || project_type === "Sash Windows") {
  show: ["window_style", "num_windows"]
}

// Always show premium features
show: ["glazing_type", "has_curves", "premium_hardware", "custom_finish"]
```

---

## Migration Path

### Step 1: Add Schema Columns
```sql
ALTER TABLE "QuestionnaireField" 
  ADD COLUMN "isStandard" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
```

### Step 2: Seed Existing Tenants
```bash
npx ts-node api/scripts/seedStandardFields.ts
```

### Step 3: Update Tenant Creation
Modify tenant creation to automatically create standard questionnaire + fields

### Step 4: Update ML Training
Extract standard fields first, then custom fields as supplementary

### Step 5: Update UI
- Settings page: separate standard/custom sections
- Questionnaire form: render standard fields with grouping
- Lead modal: prioritize standard fields for display

---

## Example: Complete Standard Questionnaire

When rendered, the form would look like:

```
PROJECT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Project Area (m²) *                    [____]
□ Materials Grade *                      [▼ Standard ▼]
□ Project Type *                         [▼ Windows ▼]

WINDOWS (shown if project_type = Windows)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Window Style                           [▼ Casement ▼]
□ Number of Windows                      [____]

PREMIUM FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Glazing Type                           [▼ Standard Double ▼]
□ Curved/Arched Design                   [ ] Yes
□ Premium Hardware                       [ ] Yes
□ Custom Finish                          [▼ None ▼]

CONTACT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Your Name *                            [____________]
□ Email *                                [____________]
□ Phone                                  [____________]
□ How did you hear about us?             [▼ Website ▼]

CUSTOM FIELDS (tenant-specific)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Any fields the tenant added]
```

---

## Next Steps

1. **Review field list** - confirm all standard fields needed
2. **Create migration** - add `isStandard` and `isHidden` columns
3. **Build seed script** - populate standard fields for all tenants
4. **Update ML training** - prioritize standard field extraction
5. **Update UI** - separate standard/custom field management
6. **Test with sample quotes** - verify ML learns from standard features

**Ready to implement when you approve the standard field list!**
