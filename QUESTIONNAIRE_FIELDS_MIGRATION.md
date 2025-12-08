# Questionnaire Fields Migration - January 2025

## Overview
Updated the standard questionnaire field system based on `joineryai_questionnaire_fields.csv` requirements. This migration adds 21+ new fields, removes 5 deprecated fields, and standardizes material tracking fields across all tenants.

## Changes Summary

### ✅ Files Updated
1. **`/api/src/lib/standardQuestionnaireFields.ts`** - Complete rewrite of STANDARD_FIELDS array
2. **`/api/src/routes/fields.ts`** - Added migration endpoint and updated deprecated fields list
3. **`/web/src/components/questionnaire/AdminQuestionnaireFieldsTable.tsx`** - Added "Migrate Fields" button

### 📋 Fields Added (21 new fields)

#### Client Profile (scope: client)
- `company` - Company name (TEXT)
- `new_build_existing` - Property type (SELECT: New Build, Existing Property, Renovation)

#### Public Questionnaire (scope: public)
- `window_style` - Window opening style (SELECT)
- `ironmongery_description` - Specific ironmongery requirements (TEXTAREA)
- `height_mm` - Height in millimeters (NUMBER) - **ML Costing Field**
- `width_mm` - Width in millimeters (NUMBER) - **ML Costing Field**
- `glazing_bars` - Include glazing bars (BOOLEAN) - **ML Costing Field**
- `preferred_installation_date` - Customer preferred date (DATE)

#### Internal (scope: internal)
- `date_quote_sent` - Auto-populated when quote sent (DATE)
- `quoted_by` - Who prepared the quote (SELECT)
- `date_of_enquiry` - Auto-populated when lead created (DATE)
- `quote_ref` - Internal reference number (TEXT)
- `quote_value` - Total quoted amount (NUMBER)
- `source` - Lead origin channel (SELECT)
- `timber` - Timber specification (SELECT)
- `site_visit_required` - Needs on-site survey (BOOLEAN)
- `date_order_placed` - Auto-populated when opportunity won (DATE)

#### Manufacturing (scope: manufacturing)
**Material Tracking - Timber:**
- `timber_ordered` - Date timber was ordered (DATE)
- `timber_expected` - Expected timber delivery date (DATE)
- `timber_received` - Date timber was received (DATE)

**Material Tracking - Glass:**
- `glass_ordered` - Date glass was ordered (DATE)
- `glass_expected` - Expected glass delivery date (DATE)
- `glass_received` - Date glass was received (DATE)

**Material Tracking - Ironmongery:**
- `ironmongery_ordered` - Date ironmongery was ordered (DATE)
- `ironmongery_expected` - Expected ironmongery delivery date (DATE)
- `ironmongery_received` - Date ironmongery was received (DATE)

**Material Tracking - Paint:**
- `paint_ordered` - Date paint was ordered (DATE)
- `paint_expected` - Expected paint delivery date (DATE)
- `paint_received` - Date paint was received (DATE)

**Production Planning:**
- `projected_hours` - Estimated production time (NUMBER)
- `signed_off_date` - Date work was approved/completed (DATE)
- `fensa_registration` - FENSA certification required (BOOLEAN)

### ❌ Fields Removed (5 deprecated fields)
- `door_height_mm` - Replaced by `height_mm` in public scope
- `door_width_mm` - Replaced by `width_mm` in public scope
- `final_width_mm` - Removed from manufacturing (deprecated precision field)
- `final_height_mm` - Removed from manufacturing (deprecated precision field)
- `installation_date` - Replaced by `installation_start_date` and `installation_end_date`

### 🔧 Fields Standardized
All material tracking fields (Timber, Glass, Ironmongery, Paint with Ordered/Expected/Received dates) are now marked as `isStandard: true` to ensure they appear for ALL tenants, not just some.

## Scope Organization

### Client Scope (Contact Information)
- 12 fields total
- Includes: contact details, company, property info, budget, timeframe

### Public Scope (Customer-Facing)
- 14 fields total
- Includes: glazing, doors, windows, dimensions (height_mm, width_mm), timber, finish, ironmongery

### Internal Scope (Backend Only)
- 10 fields total
- Includes: project type, area, quote tracking, source, timber specification, dates

### Manufacturing Scope (Post-Won Production)
- 20 fields total
- Includes: production notes, manufacturing dates, installation dates, material tracking (4 materials × 3 dates each), projected hours, sign-off, FENSA

## ML Costing Integration

### New ML Feature Fields
These fields now have `costingInputKey` set for pricing model integration:
- `height_mm` - Critical for area/size calculations
- `width_mm` - Critical for area/size calculations
- `glazing_bars` - Impacts manufacturing complexity and cost

### Existing ML Fields (kept)
- `area_m2`
- `project_type`
- `installation_required`
- `lead_source`
- `region`
- `property_listed`
- `timber_type`
- `finish`
- `glazing_type`
- `has_curves`
- `ironmongery_level`
- `door_type`
- `quantity`

## Migration Process

### How to Run Migration

1. **Access Admin Panel**
   - Navigate to `/admin/questionnaire-fields`
   - Look for the "Migrate Fields" button (purple)

2. **Click "Migrate Fields"**
   - Confirmation dialog will appear
   - Lists the 5 fields that will be deleted

3. **Migration Actions**
   - Deletes 5 deprecated fields from database
   - Creates any missing standard fields
   - Updates existing standard fields with latest definitions
   - Marks material tracking fields as standard for all tenants

4. **Result Display**
   - Success message shows counts: deleted, created, updated
   - Auto-refreshes field list to show changes

### API Endpoint
```
POST /questionnaire-fields/migrate-standard-fields
```

**Response:**
```json
{
  "success": true,
  "deleted": 5,
  "created": 21,
  "updated": 32,
  "fieldsDeleted": ["door_height_mm", "door_width_mm", "final_width_mm", "final_height_mm", "installation_date"],
  "message": "Migrated standard fields: deleted 5, created 21 new fields, updated 32 existing fields"
}
```

## Automatic Field Sync

The system automatically syncs standard fields on the following operations:
1. **GET /questionnaire-fields** - Auto-creates missing standard fields
2. **Tenant Creation** - New tenants get all standard fields automatically
3. **Manual Migration** - Use "Migrate Fields" button for immediate sync

## Testing Checklist

- [ ] Navigate to `/admin/questionnaire-fields`
- [ ] Verify "Migrate Fields" button appears
- [ ] Click button and confirm migration
- [ ] Verify success message shows correct counts
- [ ] Check that deprecated fields are removed
- [ ] Verify new fields appear in appropriate sections
- [ ] Test that material tracking fields show for all tenants
- [ ] Verify ML costing fields (height_mm, width_mm, glazing_bars) have costingInputKey
- [ ] Test public questionnaire shows new customer-facing fields
- [ ] Verify internal fields don't appear in customer views

## Important Notes

### Data Retention
- Deleted fields: Answers are retained in database but fields are removed from UI
- Existing fields: All data preserved during migration
- New fields: Start with no values; users must populate going forward

### CSV Comments Addressed
✅ "This field likely exists in the scheme and is auto entered, but wants to show and show that its calculated"
   - Implemented for date_quote_sent, date_of_enquiry, date_order_placed with helpText indicating auto-population

✅ "This field exisits but needs to show in the standard data fields"
   - Implemented for quote_value, source now in standard fields with isStandard: true

✅ "This will need creating in the ML for Costings"
   - Implemented for height_mm, width_mm, glazing_bars with costingInputKey set

✅ Material tracking fields "only for some tenants"
   - Fixed: All material tracking fields now isStandard: true for universal availability

## Rollback Plan

If issues occur, restore from backup:
```bash
cd /Users/Erin/saas-crm/api/src/lib
cp standardQuestionnaireFields.ts.backup standardQuestionnaireFields.ts
pnpm build
```

## Next Steps

1. **Run Migration** - Use the "Migrate Fields" button in admin panel
2. **Update ML Model** - Train costing model with new features (height_mm, width_mm, glazing_bars)
3. **Update Public Questionnaire** - Ensure new customer-facing fields appear in forms
4. **Update Internal Forms** - Add new internal tracking fields to appropriate UI sections
5. **Material Tracking UI** - Create dedicated manufacturing tracking views for material dates
6. **Documentation** - Update user guides with new field descriptions

## Technical Details

### Field Definition Structure
```typescript
{
  key: string;           // Unique identifier (snake_case)
  label: string;         // Display label
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "TEXTAREA" | "DATE";
  options?: string[];    // For SELECT type only
  required: boolean;     // Validation flag
  costingInputKey?: string;  // Maps to ML model feature
  helpText?: string;     // User guidance
  placeholder?: string;  // Input placeholder
  sortOrder: number;     // Display ordering
  group?: string;        // Grouping (Client Profile, Public Questionnaire, Internal, Manufacturing)
  scope: "client" | "public" | "internal" | "manufacturing";  // Visibility context
  isStandard: true;      // Always true for standard fields
}
```

### Scope Usage
- **client**: Contact forms, client profile pages
- **public**: Customer-facing questionnaires, public forms
- **internal**: Staff-only views, internal tracking
- **manufacturing**: Post-sale production tracking

## Build Status
✅ API Build: Success
✅ Web Build: Success
✅ No compilation errors introduced
✅ Backwards compatible with existing data
