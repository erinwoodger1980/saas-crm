# Field Calculations System

## Overview

Comprehensive field calculation system that allows defining formulas for any fire door line item field. Calculations are evaluated dynamically and displayed with clear indicators.

## Implementation

### Settings Page (`/web/src/app/fire-door-line-item-layout/settings/page.tsx`)

**New Features:**
- Added `fieldCalculations?: { [fieldKey: string]: string }` to `LayoutConfig` interface
- New function `updateFieldCalculation(fieldKey, formula)` to update field formulas
- Comprehensive UI section showing all 110+ line item fields with formula inputs
- Fields grouped by category (Basic Info, Dimensions, Materials, etc.)
- Formula examples and help text provided

**UI Layout:**
```tsx
<Card className="p-6">
  <h2>Field Calculations</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {ALL_LINE_ITEM_FIELDS.map((field) => (
      <div key={field.key}>
        <Label>{field.label} - {field.category}</Label>
        <Input
          value={layout.fieldCalculations?.[field.key] || ""}
          onChange={(e) => updateFieldCalculation(field.key, e.target.value)}
          placeholder="e.g., ${lineItem.masterWidth} - 6"
        />
      </div>
    ))}
  </div>
  <div>Formula Examples...</div>
</Card>
```

### Detail Page (`/web/src/app/fire-door-line-item-layout/[lineItemId]/page.tsx`)

**Enhanced `renderField()` Function:**
1. Checks if field has a calculation formula in `layout.fieldCalculations`
2. If formula exists, evaluates it using `evaluateFormula()`
3. Attempts to execute as math expression using `Function()` constructor
4. Falls back to string concatenation if not mathematical
5. Displays calculated value with:
   - Blue "Calculated" badge with calculator icon
   - Result in blue-highlighted box
   - Formula shown below in monospace font
   - Error handling with red error boxes

**Visual Indicators:**
- Calculator icon badge next to field label
- Blue background for calculated values
- Formula display in monospace
- Error messages in red if calculation fails

## Formula Syntax

### Variable Substitution
- `${lineItem.fieldName}` - Access line item field values
- `${project.fieldName}` - Access project field values

### Example Formulas

**Dimension Calculations:**
```javascript
// CNC blank width = finished width minus lipping on both sides
${lineItem.masterWidth} - (${lineItem.lippingThickness} * 2)

// Door height after top/bottom adjustments
${lineItem.doorHeight} - (${lineItem.top} + ${lineItem.btm})

// Total area calculation
${lineItem.masterWidth} * ${lineItem.doorHeight}
```

**String Concatenation:**
```javascript
// Reference code
${project.mjsNumber}-${lineItem.doorRef}

// Combined description
${lineItem.material} ${lineItem.rating} Door
```

**Complex Calculations:**
```javascript
// Multiple operations
(${lineItem.masterWidth} + ${lineItem.slaveWidth}) * 2

// Conditional-style (evaluated as JavaScript)
${lineItem.leafThickness} > 44 ? ${lineItem.masterWidth} - 6 : ${lineItem.masterWidth} - 4
```

## Usage Flow

### Setting Up Calculations

1. Navigate to Fire Door Settings (`/fire-door-line-item-layout/settings`)
2. Scroll to "Field Calculations" section
3. Find the field you want to calculate
4. Enter formula in the input box using `${lineItem.field}` syntax
5. Click "Save Configuration"

### Viewing Calculated Values

1. Open any line item detail page
2. Calculated fields show with:
   - "Calculated" badge next to label
   - Blue-highlighted result value
   - Formula displayed below
3. Values update dynamically based on source field values

## Examples

### Use Case: CNC Blank Cutting Dimensions

**Problem:** Need to calculate the size the CNC should cut the door blank based on finished dimensions minus lipping.

**Setup in Settings:**
- Field: `cncBlankWidth`
- Formula: `${lineItem.masterWidth} - (${lineItem.lippingThickness} * 2)`

**Result in Detail View:**
```
CNC Blank Width [Calculated ⚡]
┌─────────────────────────────┐
│ 756                         │ (blue background)
└─────────────────────────────┘
Formula: ${lineItem.masterWidth} - (${lineItem.lippingThickness} * 2)
```

### Use Case: Material Quantity

**Field:** `totalLinearMeters`  
**Formula:** `(${lineItem.masterWidth} + ${lineItem.doorHeight}) * 2 / 1000`

Result shows perimeter in meters, calculated from width and height.

### Use Case: Job Reference

**Field:** `fullReference`  
**Formula:** `${project.mjsNumber}-${lineItem.doorRef}-${lineItem.location}`

Result shows combined reference string.

## Technical Details

### Formula Evaluation Process

1. **Variable Replacement:** `evaluateFormula()` replaces all `${lineItem.field}` and `${project.field}` with actual values
2. **Math Evaluation:** `Function('"use strict"; return (' + evaluated + ')')()` executes the expression
3. **Fallback:** If math evaluation fails, uses the string as-is (for concatenation)
4. **Error Handling:** Try-catch wraps evaluation, displays error if formula is invalid

### Storage

- Formulas stored in `TenantSettings.fireDoorLineItemLayout` JSON field
- Structure: `{ fieldCalculations: { fieldKey: "formula", ... } }`
- Persisted alongside process configurations and CNC calculations

### Performance

- Calculations performed on-demand in `renderField()`
- No caching (recalculated on each render)
- Lightweight evaluation using native `Function()` constructor
- Only fields with formulas trigger calculation logic

## Future Enhancements

**Potential Improvements:**
- Formula validation before save (syntax checking)
- Circular dependency detection
- Calculation result caching
- Unit conversion helpers (mm to inches, etc.)
- Formula library/templates for common calculations
- Visual formula builder (drag-and-drop)
- Calculation history/audit trail
- Support for complex functions (Math.max, Math.round, etc.)

## Deployment Status

✅ **Completed (Dec 2024):**
- Settings UI with all fields displayed
- Formula input and management
- Detail page rendering with calculated values
- Visual indicators and error handling
- Build verified and successful
