# Field Calculations System Enhancements

## Overview
Enhanced the field calculations system with collapsible categories, easy field creation, and database lookup support for pricing and certification calculations.

## New Features

### 1. Collapsible Category Sections
- **Organized by Category**: All fields grouped into categories (Basic Info, Dimensions, Core Specifications, Materials, etc.)
- **Expand/Collapse UI**: Click category headers to show/hide fields
- **Active Formula Counter**: Shows "X/Y configured" count per category
- **Default State**: "Calculated" category expanded by default for easy access

### 2. Easy Field Creation
- **Add Calculated Field Button**: One-click to create new custom calculated fields
- **Dynamic Field Generation**: Creates calculatedField6, calculatedField7, etc. on demand
- **Instant Availability**: New fields immediately appear in the settings UI
- **Unlimited Fields**: Create as many calculated fields as needed for pricing calculations

### 3. Lookup Table Support
- **LOOKUP() Function**: Query database tables based on field conditions
- **Available Tables**:
  - `FireCertificationRule` - Certification lookup based on rating
  - `WeightLookup` - Weight calculations based on dimensions
  - `MaterialPricing` - Material pricing tables (placeholder)
  - `DoorPricing` - Door pricing tables (placeholder)

## Formula Syntax

### Math Operations
```
${lineItem.masterWidth} - 6
${lineItem.doorHeight} - (${lineItem.top} + ${lineItem.btm})
${lineItem.masterWidth} * 2 + ${lineItem.slaveWidth}
```

### String Concatenation
```
${project.mjsNumber}-${lineItem.doorRef}
```

### Database Lookups
```
LOOKUP(FireCertificationRule, rating=${lineItem.rating}, certification)
LOOKUP(WeightLookup, width=${lineItem.masterWidth}, weight)
LOOKUP(PricingTable, material=${lineItem.material}&rating=${lineItem.rating}, price)
```

## Lookup API

### Endpoint
```
GET /api/lookup/:tableName?field1=value1&field2=value2&returnField=fieldName
```

### Example
```
GET /api/lookup/FireCertificationRule?rating=FD30&returnField=certification
```

### Security
- Whitelist-based table access (prevents SQL injection)
- Requires authentication
- Returns `{ value: result, found: true/false }`

## Usage Examples

### Example 1: CNC Blank Size Calculation
**Field**: `cncBlankWidth`  
**Formula**: `${lineItem.masterWidth} + 6`  
**Result**: Adds 6mm to master width for CNC cutting allowance

### Example 2: Full Reference String
**Field**: `fullReference`  
**Formula**: `${project.mjsNumber}-${lineItem.doorRef}-${lineItem.rating}`  
**Result**: "MJS-12345-DR001-FD30"

### Example 3: Certification Lookup
**Field**: `certification`  
**Formula**: `LOOKUP(FireCertificationRule, rating=${lineItem.rating}, certification)`  
**Result**: Automatically populates certification based on fire rating

### Example 4: Material Pricing
**Field**: `calculatedField1` (labeled "Material Cost")  
**Formula**: `LOOKUP(MaterialPricing, material=${lineItem.material}&width=${lineItem.masterWidth}, price)`  
**Result**: Looks up material price based on material type and width

## UI Features

### Settings Page (`/fire-door-line-item-layout/settings`)
- Collapsible sections with chevron icons
- Green "Active" badge on fields with formulas
- Formula input with monospace font
- Example documentation panel
- Add Calculated Field button in header

### Detail Page (`/fire-door-line-item-layout/[lineItemId]`)
- Blue "Calculated" badge on computed fields
- Displays calculated value in blue-bordered box
- Shows formula below the value
- Error display for invalid formulas
- Loading state for LOOKUP operations

## Technical Implementation

### Frontend
- **Component**: `/web/src/app/fire-door-line-item-layout/settings/page.tsx`
- **State**: `expandedCategories` tracks collapse state
- **Icons**: `ChevronDown`, `ChevronUp` from lucide-react

### Backend
- **API Route**: `/api/src/routes/lookup.ts`
- **Registration**: `/api/src/server.ts` line 696
- **Database**: Uses Prisma Client for type-safe queries

### Formula Evaluation
- **Location**: `/web/src/app/fire-door-line-item-layout/[lineItemId]/page.tsx`
- **Function**: `evaluateFormula()` - handles field substitution
- **Function**: `evaluateLookup()` - handles async database queries
- **URL Encoding**: Smart encoding for CNC URLs vs raw values for calculations

## Next Steps for Pricing System

1. **Create Pricing Tables**:
   ```sql
   CREATE TABLE MaterialPricing (
     material VARCHAR,
     width DECIMAL,
     height DECIMAL,
     price DECIMAL,
     updatedAt TIMESTAMP
   );
   
   CREATE TABLE DoorPricing (
     rating VARCHAR,
     width DECIMAL,
     height DECIMAL,
     basePrice DECIMAL
   );
   ```

2. **Import Pricing Data**: Use CSV import or manual entry

3. **Create Pricing Formulas**:
   - Material Cost: `LOOKUP(MaterialPricing, material=${lineItem.material}...)`
   - Labor Cost: `${lineItem.totalSquareMeters} * 50` (£50 per m²)
   - Hardware Cost: `LOOKUP(IronmongeryPricing, lockType=${lineItem.lockType}...)`
   - Total Price: `${calculatedField1} + ${calculatedField2} + ${calculatedField3}`

4. **Add Price Fields to Processes**: Show calculated prices in workshop QR views

## Files Modified

1. `/web/src/app/fire-door-line-item-layout/settings/page.tsx` - Collapsible UI
2. `/web/src/app/fire-door-line-item-layout/[lineItemId]/page.tsx` - Formula evaluation
3. `/api/src/routes/lookup.ts` - NEW: Lookup API endpoint
4. `/api/src/server.ts` - Route registration

## Deployment

Pushed to GitHub (commit d05dd11a). Requires manual deployment via GitHub Actions.

Navigate to: https://github.com/erinwoodger1980/saas-crm/actions/workflows/deploy-production.yml
