# Standard Fields in Quote Builder - Implementation Guide

## Overview
Added UI for editing standard fields (lineStandard) on quote line items. These fields provide consistent structured data capture across all quotes, reducing day-one setup burden.

## Standard Fields Available
1. **widthMm** - Width in millimeters (number)
2. **heightMm** - Height in millimeters (number)
3. **timber** - Timber species (select: Oak, Sapele, Accoya, Iroko, Pine, Hemlock, MDF, Other)
4. **finish** - Finish type (select: Primed, Painted, Stained, Clear Lacquer, Wax, Oiled, Unfinished)
5. **ironmongery** - Hardware (select: None, Hinges, Handles, Locks, Full Set, Fire Rated)
6. **glazing** - Glazing type (select: None, Clear Glass, Obscure Glass, Double Glazed, Fire Rated Glass, Georgian)
7. **description** - Additional details (textarea)
8. **photoInsideFileId** - Inside photo reference (text)
9. **photoOutsideFileId** - Outside photo reference (text)

## Implementation Details

### Backend (Already Complete)
- **Database**: `QuoteLine.lineStandard` JSONB column stores all standard fields
- **API Route**: `PATCH /quotes/:id/lines/:lineId` accepts `lineStandard` object
- **Merge Logic**: Incoming lineStandard fields are merged with existing values
- **Persistence**: Updates saved immediately to database

### Frontend Components

#### ParsedLinesTable Component (`/web/src/components/quotes/ParsedLinesTable.tsx`)
**Added:**
- "Details" column with "Edit" button on each line item
- `LineStandardDialog` component for editing standard fields
- Updated `onLineChange` prop type to accept `lineStandard` parameter
- Edit button opens modal with pre-populated values from `line.lineStandard`

**UI Features:**
- Modal dialog with organized form sections
- Number inputs for dimensions (widthMm, heightMm)
- Select dropdowns for materials/finishes (timber, finish, ironmongery, glazing)
- Textarea for additional description
- Text inputs for photo file IDs
- Save/Cancel buttons with loading state
- Empty values are cleaned before save (not persisted)

#### Quote Builder Page (`/web/src/app/quotes/[id]/page.tsx`)
**Updated:**
- Modified `handleLineChange` to accept and forward `lineStandard` in payload
- Function already handles persistence and re-fetching
- Toast notifications on success/failure

#### API Client (`/web/src/lib/api/quotes.ts`)
**Updated:**
- `updateQuoteLine` type signature now includes `lineStandard?: Record<string, any>` in payload
- Existing PATCH logic handles the new field transparently

## User Workflow

### Editing Line Standard Fields
1. Navigate to Quote Builder → "Quote lines" tab
2. Click "Edit" button next to any line item
3. Modal opens with current values pre-filled (if any exist)
4. Fill in desired standard fields:
   - Enter dimensions in millimeters
   - Select materials from dropdowns
   - Add description notes
   - Enter photo file IDs if available
5. Click "Save" to persist changes
6. Modal closes, line data refetches automatically
7. Toast notification confirms save success

### Data Persistence
- Standard fields are stored in `QuoteLine.lineStandard` JSONB column
- Each line can have different standard field values
- Fields can be partially filled (only non-empty values are saved)
- Updates are immediate (no separate "Save mappings" step required)
- Data survives quote updates and re-parses

## Integration with Standard Field Mappings

### Settings System (Already Complete)
- **Route**: `/app/settings/standard-field-mappings`
- **Purpose**: Map standard fields to questionnaire questions/attributes by product type
- **Use Case**: When quotes are created, system can auto-populate lineStandard from questionnaire answers based on mappings

### Future Enhancement (Not Yet Implemented)
When saving quote lines, the system should:
1. Check if a StandardFieldMapping exists for the line's product type
2. Read the mapped questionCode or attributeCode
3. Extract value from questionnaire answers or attributes
4. Apply transformExpression if defined
5. Overwrite lineStandard[standardField] with transformed value
6. Persist to database

This logic will be added to the quote save/update flow once product type assignment is implemented.

## Testing Checklist

### Manual Testing Steps
1. **Create Quote Line**
   - Parse supplier PDF or generate ML estimate
   - Verify line items appear in table
   - Confirm "Edit" button visible in Details column

2. **Edit Standard Fields**
   - Click "Edit" on a line item
   - Verify modal opens with form fields
   - Enter widthMm: 826, heightMm: 2040
   - Select timber: Oak, finish: Painted
   - Add description: "Test door specification"
   - Click "Save"
   - Verify toast notification appears
   - Verify modal closes

3. **Verify Persistence**
   - Refresh page
   - Click "Edit" on same line
   - Verify all entered values are still present
   - Click "Cancel" (values should remain unchanged)

4. **Edit Existing Values**
   - Open edit modal on previously edited line
   - Change widthMm to 900
   - Save and verify update persists

5. **Partial Updates**
   - Edit line with some fields filled
   - Only modify one field (e.g., change timber)
   - Verify other fields remain unchanged after save

6. **Empty Values**
   - Edit line and clear a previously set field
   - Save and verify field is removed (not stored as empty string)

## Database Schema

```sql
-- QuoteLine table already has lineStandard column
ALTER TABLE "QuoteLine" ADD COLUMN IF NOT EXISTS "lineStandard" JSONB;

-- Example lineStandard value
{
  "widthMm": 826,
  "heightMm": 2040,
  "timber": "oak",
  "finish": "painted",
  "ironmongery": "full_set",
  "glazing": "clear",
  "description": "Custom door with side panels",
  "photoInsideFileId": "file-abc123",
  "photoOutsideFileId": "file-def456"
}
```

## API Request/Response Examples

### Update Line with Standard Fields
```http
PATCH /quotes/quote-123/lines/line-456
Content-Type: application/json

{
  "lineStandard": {
    "widthMm": 826,
    "heightMm": 2040,
    "timber": "oak",
    "finish": "painted",
    "description": "Main entrance door"
  }
}
```

### Response
```json
{
  "id": "line-456",
  "description": "Oak Door Panel",
  "qty": 1,
  "unitPrice": 450.00,
  "currency": "GBP",
  "meta": { ... },
  "lineStandard": {
    "widthMm": 826,
    "heightMm": 2040,
    "timber": "oak",
    "finish": "painted",
    "description": "Main entrance door"
  },
  "sellUnit": 562.50,
  "sellTotal": 562.50,
  ...
}
```

## Files Modified

1. `/web/src/components/quotes/ParsedLinesTable.tsx`
   - Added Edit button column
   - Created LineStandardDialog component
   - Updated prop types for lineStandard support

2. `/web/src/app/quotes/[id]/page.tsx`
   - Updated handleLineChange to accept lineStandard
   - No other changes needed (function already handles persistence)

3. `/web/src/lib/api/quotes.ts`
   - Updated updateQuoteLine type signature
   - Added lineStandard to payload type

## Build Status
✅ All changes built successfully with no errors
✅ Type checking passed
✅ No runtime warnings

## Next Steps

### Recommended Enhancements
1. **Photo Upload Integration**
   - Add file upload buttons in modal instead of manual file ID entry
   - Integrate with existing file upload system
   - Show thumbnail previews of photos

2. **Auto-population from Mappings**
   - Implement logic to apply StandardFieldMapping overrides when saving quotes
   - Read questionnaire answers based on mapped questionCode
   - Apply transformExpression to derived values

3. **Validation**
   - Add min/max constraints on dimension fields
   - Validate timber/finish/ironmongery/glazing values against enum
   - Show validation errors in modal

4. **Display in Quote PDF**
   - Include standard fields in generated quote documents
   - Show dimensions and materials in line item descriptions
   - Attach photos if available

5. **Bulk Edit**
   - Allow editing multiple lines at once when they share common fields
   - "Apply to all" button for timber/finish selections

6. **Field Templates**
   - Save frequently used combinations as templates
   - Quick-fill button to apply template values

## Support
For issues or questions:
- Check console for error messages
- Verify database migrations are applied
- Confirm API route is accessible
- Review browser network tab for API failures
