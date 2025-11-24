# Material Cost Import Summary

## Overview
Comprehensive material cost import from Door Production spreadsheet to LAJ Joinery database, ensuring exact price matching for door costing calculations.

## Import Results

### Database Tables Populated

1. **DoorCore** - 97 items
   - Door cores from "Door Core Prices" sheet
   - Range: £27.95 - £1,209 per core
   - Includes: Strebord, Stredor, Moralt Firesmoke/Firesound, Flamebreak, Halspan
   - Fire ratings: FD30, FD60, FD90, FD120
   - Dimensions: 44mm and 54mm thickness, various heights/widths

2. **IronmongeryItem** - 1 item
   - Legacy lock from Door Production sheet (placeholder)
   - Note: Dedicated Ironmongery sheet format not yet fully parsed

3. **MaterialItem** - 303 items across 10 categories:

   - **DOOR_BLANK** (6 items)
     - Fire-rated hardwood/softwood cores
     - Range: £27-£120 per m²
     
   - **LIPPING** (24 items)
     - 8mm and 10mm thickness
     - 48mm and 58mm widths
     - 2400mm length
     - Materials: FSC Oak, FSC Ash, FSC Sapele, CND FSC Beech, Maple, MDF
     - Range: £2.05-£15 per piece/meter
     
   - **TIMBER** (160 items)
     - **Linings**: 32mm, 44mm thickness in various widths (100-150mm)
     - **Architraves/Stops**: 12mm, 18mm, 21mm, 23mm thickness
     - **Special sizes**: Various custom dimensions for frame components
     - Materials: FSC Oak, FSC Ash, FSC Sapele, CND FSC Beech, Maple, European Oak, MDF, Streframe
     - Range: £1.50-£64.75 per piece
     
   - **GLASS** (39 items)
     - Fire-rated glass: Pyrodur, Pyrobelite, Pyroguard, Pyrobel, Firelite
     - Fire ratings: 30/0, 60/0, 60/30, 60/60
     - Thickness: 5mm - 26.6mm
     - Laminated safety glass: Clear and acoustic options
     - Special products: Hygeno flush view, IGU make-up, sandblast
     - Range: £20-£1,200 per m²
     
   - **VENEER** (59 items)
     - Wood species: Oak (Crown/Qtd/Rift/Pippy/Rough Sawn), Ash, Beech, Birch, Walnut, Maple, Sapele, Cherry, Mahogany, Teak, Wenge, Ebony, and many more
     - Special finishes: Smoked/Fumed Oak, Birds Eye Maple, Figured Sycamore
     - Paint grade and primed options
     - Range: £1.90-£85 per m²
     
   - **BOARD** (2 items)
     - Fire-rated MDF and Plywood sheets
     - 2440x1220mm standard size
     - Range: £38-£52 per sheet
     
   - **FINISH** (4 items)
     - Fire-rated stains (oak, clear)
     - Fire-rated primer and topcoat
     - Range: £28-£45 per container
     
   - **HARDWARE** (1 item)
     - Fire door screws (box of 200)
     - £8.50 per box
     
   - **IRONMONGERY** (6 items)
     - Complete FD30/FD60 ironmongery packs
     - Individual items: hinges, closers
     - Range: £12.50-£195 per item/pack
     
   - **CONSUMABLE** (2 items)
     - D4 PVA adhesive
     - Abrasive packs
     - Range: £15-£22 per item

## Excel Sheet Sources

Successfully parsed the following sheets:

1. **Door Core Prices** → DoorCore table
   - 97 cores with complete pricing and specifications
   
2. **Timber Prices** → MaterialItem (LIPPING, TIMBER categories)
   - Sections: Lippings, Linings (multiple size ranges)
   - 176 timber items with dimension-based pricing
   
3. **Glass Prices** → MaterialItem (GLASS category)
   - Fire-rated and standard glass products
   - 41 glass items with fire ratings and thickness
   
4. **Veneer Layon Prices 2024** → MaterialItem (VENEER category)
   - 57 veneer types with £/m² pricing
   
5. **Door Production** → Legacy material references
   - Additional door blanks, boards, finishes, hardware, consumables

## Pricing Accuracy

✓ **All prices imported from spreadsheet exactly as specified**

- Door cores: Unit costs from "Door Core Prices" sheet
- Timber: Dimension-specific pricing by wood type
- Glass: Per m² pricing with fire rating specifications
- Veneer: Per m² pricing for each species
- Material items maintain original £ values from spreadsheet

## Database Schema

### DoorCore Fields
- `code`, `name`, `supplier`, `unitCost`, `fireRating`, `maxHeight`, `maxWidth`
- All cores scoped to `tenantId: cmi57aof70000itdhlazqjki7`

### MaterialItem Fields
- `category`, `code`, `name`, `description`, `cost`, `currency`, `unit`
- Categories use enum: DOOR_BLANK, LIPPING, IRONMONGERY, GLASS, TIMBER, BOARD, VENEER, FINISH, HARDWARE, CONSUMABLE, OTHER
- All items scoped to LAJ Joinery tenant

### IronmongeryItem Fields
- `category`, `code`, `name`, `supplier`, `unitCost`
- Categories: HINGE, PIVOT, DOOR_CLOSER, LOCK, LATCH, LEVER_HANDLE, PULL_HANDLE, ESCUTCHEON, TURN, CYLINDER

## Import Script

**File**: `/Users/Erin/saas-crm/import-material-costs.py`

### Key Functions

- `parse_core_prices_sheet()`: Extracts door cores with pricing
- `parse_timber_prices()`: Parses lippings and linings with dimensions
- `parse_glass_prices()`: Extracts fire-rated glass products
- `parse_veneer_prices()`: Parses veneer types with £/m² pricing
- `parse_ironmongery_sheet()`: Attempts to parse dedicated ironmongery sheet
- `import_door_cores()`: Inserts to DoorCore table with ON CONFLICT upsert
- `import_material_items()`: Inserts to MaterialItem table with category mapping
- `import_ironmongery()`: Inserts to IronmongeryItem table

### Usage

```bash
python3 import-material-costs.py <tenant_id>
```

Example:
```bash
python3 import-material-costs.py cmi57aof70000itdhlazqjki7
```

## Verification Scripts

### verify-material-import.py
Shows door core and ironmongery counts with top items by cost.

### verify-materials-comprehensive.py
Shows all MaterialItem categories with counts and sample items by cost.

```bash
cd /Users/Erin/saas-crm/api/scripts
python3 verify-materials-comprehensive.py
```

## Next Steps

### Completed
- ✓ Import all door core prices from "Door Core Prices" sheet
- ✓ Import comprehensive timber prices (lippings, linings, architraves)
- ✓ Import fire-rated glass products with specifications
- ✓ Import complete veneer catalog with pricing
- ✓ Import material items from Door Production sheet (boards, finishes, hardware)

### Pending
- Parse dedicated "Ironmongery" sheet for comprehensive ironmongery catalog
  - Current: Only 1 legacy lock imported
  - Target: Full catalog with hinges, locks, handles, closers, etc.
  
- Validate pricing calculations in fire door quote builder
  - Test costing accuracy against spreadsheet formulas
  - Ensure dropdown selectors show all imported items
  - Verify line item totals match spreadsheet calculations

### Future Enhancements
- Add supplier management for material sourcing
- Import lead times and stock levels
- Link materials to specific door specifications
- Add material alternatives/substitutions

## Notes

- All imports use ON CONFLICT upserts for idempotency
- Tenant-scoped data ensures multi-tenant isolation
- UUID primary keys generated for all new records
- Currency set to GBP for all cost fields
- Original spreadsheet structure preserved in descriptions for traceability
