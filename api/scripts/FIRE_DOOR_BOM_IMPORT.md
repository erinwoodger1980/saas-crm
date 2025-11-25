# Fire Door BOM Import Script

## Overview
This script imports fire door projects from a CSV export into the Fire Door Schedule system.

## CSV Format
- **Header row**: Row 2 (first row contains column codes)
- **Expected columns**:
  - MJS, CUSTOMER, JOB DESCRIPTION
  - DATE RECEIVED IN RED FOLDER, JOB LOCATION, SIGN OFF STATUS
  - LAJ SCHEDULER, DATE SIGNED OFF, LEAD TIME IN WEEKS
  - BLANKS, LIPPINGS, FACINGS, GLASS, CASSETTES, TIMBERS, IRONMONGERY (status)
  - DOOR PAPERWORK, FINAL CNC SHEET, FINAL CHECKS SHEET, DELIVERY CHECKLIST, FRAMES PAPERWORK, PAPERWORK COMMENTS
  - BLANKS CUT, EDGEBAND, CALIBRATE, FACINGS, FINAL CNC, FINISH, SAND, SPRAY, CUT, CNC, BUILD, PROGRESS (percentages)
  - TRANSPORT, DOOR SETS, LEAVES, NOTES

## Usage

1. Get your tenant ID from the database or API
2. Run the import script:

```bash
cd api
tsx scripts/import-fire-door-bom.ts /path/to/file.csv <tenant-id>
```

Example:
```bash
tsx scripts/import-fire-door-bom.ts /Users/Erin/Desktop/Copy\ BOM.csv abc123-def456-ghi789
```

## Features
- Skips rows without MJS numbers
- Checks for existing projects (won't import duplicates)
- Parses dates in DD/MM/YYYY format
- Converts percentages (removes % sign)
- Maps all material statuses and paperwork fields
- Provides detailed import summary

## Default Filtering
After import, the Fire Door Schedule will:
- Hide "COMPLETE & DELIVERED" projects by default
- Show them when searching by MJS number (or other fields)
- Allow viewing all via location filter

## Notes
- Date fields with "00-Jan-00" are treated as invalid/null
- Empty or N/A percentages are set to null
- The script is idempotent - re-running won't create duplicates
