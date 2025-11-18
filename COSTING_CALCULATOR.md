# Door Costing Calculator

A standalone tool for calculating derived door dimensions from specifications, separate from the main quote builder workflow.

## Location

**URL**: `/costing-calculator`  
**Navigation**: Available in the main app shell sidebar (Calculator icon)

## Features

### Input Specifications
- **Frame Dimensions**: Width, height, wall thickness, lining thickness
- **Configuration**: Frame type (Standard/Rebated/Face-Fixed/Flush), leaf configuration (Single/Double/Leaf & a Half/Leaf Only)
- **Materials**: Frame material selection, fire rating, core type
- **Leaf Details**: Master/slave leaf dimensions, areas, weights
- **Core & Lipping**: Core type/thickness, lipping material

### Calculated Outputs
- **Opening Dimensions**: S/O and O/F widths/heights
- **Frame Details**: Frame thickness, extension lining (visible & actual)
- **Leaf Dimensions**: Slave leaf width, leaf thickness, lipping width
- **Core Sizing**: Core width/height with validation status
- **Weight Calculations**: Leaf weight density and per-leaf weights

### Validation
- Automatic core size validation (standard/non-standard/check pricing)
- Visual warnings for oversized cores requiring supplier confirmation
- Status indicators for all calculated values

## Architecture

### Core Engine
- **Location**: `src/lib/costing/derived-dimensions.ts`
- Pure calculation functions derived from Excel costing formulas
- Type-safe interfaces for inputs/outputs
- No database dependencies (can be used anywhere)

### Sample Rules
- **Location**: `src/lib/costing/sample-rules.ts`
- Implements `DimensionRules` interface with lookup tables
- Provides realistic defaults for frame types and configurations
- Easy to replace with database-backed implementation

### UI Component
- **Location**: `src/app/costing-calculator/page.tsx`
- Client-side React component
- Real-time calculations (no API calls needed)
- Responsive two-column layout (inputs | results)

## Usage Example

```typescript
import { calculateDerivedDimensions, type DoorCostingInput } from '@/lib/costing';
import { SampleDimensionRules } from '@/lib/costing/sample-rules';

const rules = new SampleDimensionRules();

const input: DoorCostingInput = {
  frameWidthMm: 926,
  frameHeightMm: 2040,
  frameType: "Standard",
  leafConfiguration: "Single",
  // ... other properties
};

const results = calculateDerivedDimensions(input, rules);
console.log(results.openingWidthMm); // 826
console.log(results.leafThicknessMm); // 44
```

## Integration Points

This tool is **independent** of the quote builder workflow and can be used for:
- Quick dimension calculations without creating quotes
- Training/reference for sales team
- Pre-quote sizing and feasibility checks
- Integration into other workflows (e.g., workshop planning)

## Future Enhancements

1. **Database-backed rules**: Replace sample lookup tables with tenant-specific configurations
2. **Save calculations**: Store calculation history for reference
3. **Export results**: Generate PDF reports of calculations
4. **Template library**: Pre-configured door types for quick calculations
5. **Integration with quote builder**: Import calculated dimensions into quotes
